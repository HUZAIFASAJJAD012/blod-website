import "server-only";
import { db, Prisma } from "@/lib/db";
import { articleInput, type ArticleInput, type WorkflowAction } from "@/lib/schemas/article";
import { sanitizeDoc, EMPTY_DOC } from "@/lib/content/schema";
import { docToPlainText, readingMinutes } from "@/lib/content/extract";
import { can, canEditArticle, canViewArticleInAdmin, ForbiddenError, type Actor } from "@/lib/permissions";
import { slugify } from "@/lib/utils/slug";
import { randomToken, sha256 } from "@/lib/utils/crypto";
import { validateCanonicalOverride } from "@/lib/seo/urls";
import { audit } from "@/server/security/audit";
import { upsertRedirect } from "@/server/redirects";
import { canTransition, transitionTarget } from "./workflow";
import { publishReadiness, runContentChecks, saveContentChecks } from "./checks";
import { revalidateArticleSurfaces } from "./revalidate";

export class ConflictError extends Error {
  status = 409;
}
export class ValidationError extends Error {
  status = 422;
  constructor(
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export const editorInclude = {
  tags: { include: { tag: true } },
  secondaryCategories: true,
  references: { orderBy: { sortOrder: "asc" } },
  related: { orderBy: { sortOrder: "asc" }, include: { related: { select: { id: true, title: true, slug: true, status: true } } } },
  coverMedia: true,
  ogImage: true,
  author: { select: { id: true, name: true } },
  checks: { orderBy: [{ severity: "desc" }, { checkType: "asc" }] },
} satisfies Prisma.ArticleInclude;

export type EditorArticle = Prisma.ArticleGetPayload<{ include: typeof editorInclude }>;

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "untitled";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await db.article.findFirst({ where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${root}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

export async function loadForEditor(actor: Actor, id: string) {
  const a = await db.article.findUnique({ where: { id }, include: editorInclude });
  if (!a || !canViewArticleInAdmin(actor, a)) return null;
  return a;
}

export async function createDraft(actor: Actor, opts: { title?: string; categoryId?: string } = {}) {
  if (!can(actor, "article.create")) throw new ForbiddenError();
  const category = opts.categoryId
    ? await db.category.findUnique({ where: { id: opts.categoryId } })
    : await db.category.findFirst({ orderBy: [{ sortOrder: "asc" }] });
  if (!category) throw new ValidationError("Create at least one category before writing articles.");
  const title = opts.title?.trim() || "Untitled draft";
  const article = await db.article.create({
    data: {
      title,
      slug: await uniqueSlug(title === "Untitled draft" ? `draft-${Date.now().toString(36)}` : title),
      excerpt: "",
      bodyJson: EMPTY_DOC as Prisma.InputJsonValue,
      primaryCategoryId: category.id,
      authorId: actor.id,
    },
  });
  await audit({ actorId: actor.id, action: "article.create", entityType: "Article", entityId: article.id, summary: { title } });
  return article;
}

/** Editable snapshot stored in revisions and used to restore. */
function snapshotOf(a: EditorArticle) {
  return {
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    bodyJson: a.bodyJson,
    primaryCategoryId: a.primaryCategoryId,
    secondaryCategoryIds: a.secondaryCategories.map((c) => c.categoryId),
    tagIds: a.tags.map((t) => t.tagId),
    coverMediaId: a.coverMediaId,
    ogImageId: a.ogImageId,
    type: a.type,
    schemaType: a.schemaType,
    visibility: a.visibility,
    relatedIds: a.related.map((r) => r.relatedId),
    authorId: a.authorId,
    reviewerId: a.reviewerId,
    testedEnvironment: a.testedEnvironment,
    verification: a.verification,
    references: a.references.map((r) => ({ title: r.title, url: r.url, publisher: r.publisher, accessedAt: r.accessedAt.toISOString(), referenceType: r.referenceType, isPrimary: r.isPrimary })),
    lastVerifiedAt: a.lastVerifiedAt?.toISOString() ?? null,
    correctionsNote: a.correctionsNote,
    revisionReason: a.revisionReason,
    affiliateDisclosureFlag: a.affiliateDisclosureFlag,
    affiliateDisclosureText: a.affiliateDisclosureText,
    metaTitle: a.metaTitle,
    metaDescription: a.metaDescription,
    searchIntent: a.searchIntent,
    secondaryQueries: a.secondaryQueries,
    canonicalOverride: a.canonicalOverride,
    robotsIndex: a.robotsIndex,
    robotsFollow: a.robotsFollow,
    ogTitle: a.ogTitle,
    ogDescription: a.ogDescription,
    featuredOnHome: a.featuredOnHome,
    featuredRank: a.featuredRank,
    pinnedUntil: a.pinnedUntil?.toISOString() ?? null,
    brief: a.brief,
  };
}
export type ArticleSnapshot = ReturnType<typeof snapshotOf>;

async function writeRevision(tx: Prisma.TransactionClient, articleId: string, actorId: string, summary: string) {
  const a = await tx.article.findUniqueOrThrow({ where: { id: articleId }, include: editorInclude });
  const last = await tx.articleRevision.findFirst({ where: { articleId }, orderBy: { version: "desc" }, select: { version: true } });
  await tx.articleRevision.create({
    data: { articleId, authorId: actorId, version: (last?.version ?? 0) + 1, snapshotJson: snapshotOf(a) as Prisma.InputJsonValue, summary: summary.slice(0, 300) },
  });
}

export type SaveResult = { id: string; version: number; slug: string; savedAt: string; redirectCreated?: string };

/**
 * Save (manual or autosave). Optimistic concurrency via `expectedVersion`: if
 * someone else saved in between, a ConflictError is thrown and nothing is written.
 */
export async function saveArticle(
  actor: Actor,
  id: string,
  raw: unknown,
  opts: { expectedVersion: number; autosave: boolean; revisionSummary?: string },
): Promise<SaveResult> {
  const parsed = articleInput.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[i.path.join(".")] ??= i.message;
    throw new ValidationError("Some fields need attention.", fe);
  }
  const input: ArticleInput = parsed.data;
  const current = await db.article.findUnique({ where: { id }, select: { id: true, authorId: true, status: true, slug: true, version: true, firstPublishedAt: true, canonicalOverride: true } });
  if (!current) throw new ForbiddenError("Article not found.");
  if (!canEditArticle(actor, current)) throw new ForbiddenError("You can't edit this article in its current state.");
  if (current.version !== opts.expectedVersion) throw new ConflictError("This article was changed elsewhere. Reload to see the latest version before saving.");

  // Only editors+ reassign authors; authors are always themselves.
  const authorId = can(actor, "article.editAny") ? input.authorId : current.authorId;
  const [author, reviewer] = await Promise.all([
    db.user.findFirst({ where: { id: authorId, status: "ACTIVE" }, select: { id: true } }),
    input.reviewerId ? db.user.findFirst({ where: { id: input.reviewerId, status: "ACTIVE", role: { in: ["EDITOR", "ADMIN", "OWNER"] } }, select: { id: true } }) : null,
  ]);
  if (!author) throw new ValidationError("Choose an active author.", { authorId: "Choose an active author." });
  if (input.reviewerId && !reviewer) throw new ValidationError("Reviewer must be an active editor.", { reviewerId: "Reviewer must be an active editor." });

  const slugClash = await db.article.findFirst({ where: { slug: input.slug, NOT: { id } }, select: { id: true } });
  if (slugClash) throw new ValidationError("That slug is already used by another article.", { slug: "That slug is already used by another article." });

  if (input.canonicalOverride && input.canonicalOverride !== current.canonicalOverride) {
    if (!can(actor, "settings.manage")) throw new ValidationError("Only admins can override the canonical URL.", { canonicalOverride: "Only admins can override the canonical URL." });
    const c = validateCanonicalOverride(input.canonicalOverride);
    if (!c.ok) throw new ValidationError(c.error, { canonicalOverride: c.error });
  }

  const featuredAllowed = current.status === "PUBLISHED" && can(actor, "article.review");
  const body = sanitizeDoc(input.bodyJson);
  const bodyText = docToPlainText(body);
  const slugChanged = current.slug !== input.slug;
  const wasLive = current.status === "PUBLISHED" && current.firstPublishedAt;

  const relatedIds = [...new Set(input.relatedIds.filter((r) => r !== id))].slice(0, 5);
  const validRelated = relatedIds.length
    ? (await db.article.findMany({ where: { id: { in: relatedIds }, status: "PUBLISHED" }, select: { id: true } })).map((r) => r.id)
    : [];

  const result = await db.$transaction(async (tx) => {
    // Create any brand-new tags (dedup by slug).
    const tagIds = new Set(input.tagIds);
    for (const name of input.newTags) {
      const slug = slugify(name);
      if (!slug) continue;
      const tag = await tx.tag.upsert({ where: { slug }, create: { name: name.trim(), slug }, update: {} });
      tagIds.add(tag.id);
    }

    const updated = await tx.article.update({
      where: { id, version: opts.expectedVersion },
      data: {
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt,
        bodyJson: body as Prisma.InputJsonValue,
        bodyText,
        readingMinutes: readingMinutes(bodyText),
        primaryCategoryId: input.primaryCategoryId,
        coverMediaId: input.coverMediaId ?? null,
        ogImageId: input.ogImageId ?? null,
        type: input.type,
        schemaType: input.type === "NEWS" ? "NEWS_ARTICLE" : input.schemaType === "NEWS_ARTICLE" ? "BLOG_POSTING" : input.schemaType,
        visibility: input.visibility,
        authorId,
        reviewerId: input.reviewerId ?? null,
        testedEnvironment: input.testedEnvironment,
        verification: input.verification,
        lastVerifiedAt: input.lastVerifiedAt,
        correctionsNote: input.correctionsNote,
        revisionReason: input.revisionReason,
        affiliateDisclosureFlag: input.affiliateDisclosureFlag,
        affiliateDisclosureText: input.affiliateDisclosureText,
        metaTitle: input.metaTitle,
        metaDescription: input.metaDescription,
        searchIntent: input.searchIntent,
        secondaryQueries: input.secondaryQueries,
        canonicalOverride: input.canonicalOverride,
        robotsIndex: input.robotsIndex,
        robotsFollow: input.robotsFollow,
        ogTitle: input.ogTitle,
        ogDescription: input.ogDescription,
        featuredOnHome: featuredAllowed ? input.featuredOnHome : false,
        featuredRank: featuredAllowed ? (input.featuredRank ?? null) : null,
        pinnedUntil: featuredAllowed ? input.pinnedUntil : null,
        brief: input.brief,
        ...(wasLive && input.markMaterialUpdate && !opts.autosave ? { materiallyUpdatedAt: new Date() } : {}),
        version: { increment: 1 },
        tags: { deleteMany: {}, create: [...tagIds].map((tagId) => ({ tagId })) },
        secondaryCategories: {
          deleteMany: {},
          create: [...new Set(input.secondaryCategoryIds)].filter((c) => c !== input.primaryCategoryId).map((categoryId) => ({ categoryId })),
        },
        related: { deleteMany: {}, create: validRelated.map((relatedId) => ({ relatedId, sortOrder: relatedIds.indexOf(relatedId) })) },
        references: {
          deleteMany: {},
          create: input.references.map((r, i) => ({
            title: r.title,
            url: r.url,
            publisher: r.publisher,
            accessedAt: new Date(r.accessedAt),
            referenceType: r.referenceType,
            isPrimary: r.isPrimary,
            sortOrder: i,
          })),
        },
      },
      select: { id: true, version: true, slug: true, updatedAt: true },
    });

    let redirectCreated: string | undefined;
    if (slugChanged && wasLive && input.createRedirectOnSlugChange) {
      await upsertRedirect({ fromPath: `/guides/${current.slug}`, to: `/guides/${input.slug}`, status: 301, reason: `Slug changed on ${new Date().toISOString().slice(0, 10)}` }, tx);
      redirectCreated = `/guides/${current.slug}`;
    }
    // A brand-new slug must not be shadowed by an old redirect rule.
    if (slugChanged) await tx.redirect.deleteMany({ where: { fromPath: `/guides/${input.slug}` } });

    if (!opts.autosave) await writeRevision(tx, id, actor.id, opts.revisionSummary || input.revisionReason || "Saved");
    else {
      // Autosaves keep at most one revision per 10 minutes so history stays useful.
      const lastRev = await tx.articleRevision.findFirst({ where: { articleId: id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      if (!lastRev || Date.now() - lastRev.createdAt.getTime() > 10 * 60_000) await writeRevision(tx, id, actor.id, "Autosave");
    }

    await audit({ actorId: actor.id, action: opts.autosave ? "article.autosave" : "article.save", entityType: "Article", entityId: id, summary: { version: updated.version, slugChanged, redirectCreated: redirectCreated ?? null } }, tx);
    return { ...updated, redirectCreated };
  });

  if (current.status === "PUBLISHED" && !opts.autosave) await revalidateArticleSurfaces(id, slugChanged ? [current.slug] : []);
  if (!opts.autosave) await saveContentChecks(id, await runContentChecks(id));

  return { id: result.id, version: result.version, slug: result.slug, savedAt: result.updatedAt.toISOString(), redirectCreated: result.redirectCreated };
}

export async function transitionArticle(actor: Actor, id: string, action: WorkflowAction, opts: { scheduledAt?: string; timezone?: string; note?: string } = {}) {
  const a = await db.article.findUnique({ where: { id }, select: { id: true, authorId: true, status: true, firstPublishedAt: true, reviewerId: true, title: true } });
  if (!a) throw new ForbiddenError("Article not found.");
  const check = canTransition(actor, a, action);
  if (!check.ok) throw new ForbiddenError(check.reason);

  if (action === "publish" || action === "schedule") {
    const problems = await publishReadiness(id);
    if (problems.length) throw new ValidationError(`Not ready to publish: ${problems.join(" ")}`);
  }

  const to = transitionTarget(action);
  const data: Prisma.ArticleUpdateInput = { status: to, version: { increment: 1 } };
  const now = new Date();
  if (action === "schedule") {
    const when = opts.scheduledAt ? new Date(opts.scheduledAt) : null;
    if (!when || Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) throw new ValidationError("Choose a publication time at least one minute in the future.");
    data.scheduledAt = when;
    data.scheduleTimezone = opts.timezone?.slice(0, 64) ?? "UTC";
  }
  if (action === "publish") {
    data.scheduledAt = null;
    if (!a.firstPublishedAt) data.firstPublishedAt = now;
  }
  if (action === "approve" || ((action === "publish" || action === "schedule") && !a.reviewerId)) {
    data.reviewer = { connect: { id: actor.id } };
    data.reviewedAt = now;
  }
  if (action === "unpublish") {
    data.scheduledAt = null;
    data.featuredOnHome = false;
    data.featuredRank = null;
  }
  if (action === "archive") {
    data.archivedAt = now;
    data.featuredOnHome = false;
    data.featuredRank = null;
    data.scheduledAt = null;
  }
  if (action === "restoreDraft") data.archivedAt = null;

  await db.$transaction(async (tx) => {
    // Status guard in WHERE makes concurrent transitions safe (second one fails).
    const res = await tx.article.updateMany({ where: { id, status: a.status }, data: { status: to } });
    if (res.count !== 1) throw new ConflictError("The article's status changed while you were working. Reload and try again.");
    await tx.article.update({ where: { id }, data });
    await writeRevision(tx, id, actor.id, `${action}${opts.note ? `: ${opts.note}` : ""}`);
    await audit({ actorId: actor.id, action: `article.${action}`, entityType: "Article", entityId: id, summary: { from: a.status, to, scheduledAt: opts.scheduledAt ?? null, note: opts.note ?? null } }, tx);
  });

  if (action === "publish" || action === "unpublish" || action === "archive" || a.status === "PUBLISHED") await revalidateArticleSurfaces(id);
  return { status: to };
}

/**
 * Cron: publish everything due. Each row is claimed with a conditional UPDATE so
 * overlapping cron invocations can never publish (or revalidate) twice.
 */
export async function publishDueArticles(now = new Date()) {
  const due = await db.article.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now } }, select: { id: true, firstPublishedAt: true, scheduledAt: true } });
  const published: string[] = [];
  for (const a of due) {
    const claimed = await db.article.updateMany({
      where: { id: a.id, status: "SCHEDULED", scheduledAt: { lte: now } },
      data: { status: "PUBLISHED", firstPublishedAt: a.firstPublishedAt ?? a.scheduledAt ?? now, scheduledAt: null, version: { increment: 1 } },
    });
    if (claimed.count === 1) {
      published.push(a.id);
      await audit({ actorId: null, action: "article.scheduled_publish", entityType: "Article", entityId: a.id, summary: { at: now.toISOString() } });
      await revalidateArticleSurfaces(a.id);
    }
  }
  return published;
}

export async function duplicateAsDraft(actor: Actor, id: string) {
  if (!can(actor, "article.create")) throw new ForbiddenError();
  const src = await db.article.findUnique({ where: { id }, include: editorInclude });
  if (!src || !canViewArticleInAdmin(actor, src)) throw new ForbiddenError();
  const copy = await db.article.create({
    data: {
      title: `${src.title} (copy)`,
      slug: await uniqueSlug(`${src.slug}-copy`),
      excerpt: src.excerpt,
      bodyJson: src.bodyJson as Prisma.InputJsonValue,
      bodyText: src.bodyText,
      readingMinutes: src.readingMinutes,
      primaryCategoryId: src.primaryCategoryId,
      authorId: actor.id,
      type: src.type,
      schemaType: src.schemaType,
      coverMediaId: src.coverMediaId,
      testedEnvironment: src.testedEnvironment as Prisma.InputJsonValue,
      metaTitle: src.metaTitle,
      metaDescription: src.metaDescription,
      tags: { create: src.tags.map((t) => ({ tagId: t.tagId })) },
      references: { create: src.references.map((r) => ({ title: r.title, url: r.url, publisher: r.publisher, accessedAt: r.accessedAt, referenceType: r.referenceType, isPrimary: r.isPrimary, sortOrder: r.sortOrder })) },
    },
  });
  await audit({ actorId: actor.id, action: "article.duplicate", entityType: "Article", entityId: copy.id, summary: { from: id } });
  return copy;
}

export async function restoreRevision(actor: Actor, articleId: string, revisionId: string) {
  const [a, rev] = await Promise.all([
    db.article.findUnique({ where: { id: articleId }, select: { id: true, authorId: true, status: true, version: true, slug: true } }),
    db.articleRevision.findFirst({ where: { id: revisionId, articleId } }),
  ]);
  if (!a || !rev) throw new ForbiddenError("Revision not found.");
  if (!canEditArticle(actor, a)) throw new ForbiddenError();
  const snap = rev.snapshotJson as unknown as ArticleSnapshot;
  // Keep the current slug: restoring must never silently move a live URL.
  const res = await saveArticle(actor, articleId, { ...snap, slug: a.slug, newTags: [], markMaterialUpdate: false, createRedirectOnSlugChange: false }, {
    expectedVersion: a.version,
    autosave: false,
    revisionSummary: `Restored revision v${rev.version}`,
  });
  await audit({ actorId: actor.id, action: "article.restore_revision", entityType: "Article", entityId: articleId, summary: { revisionId, version: rev.version } });
  return res;
}

export async function createPreviewToken(actor: Actor, articleId: string, hours = 48) {
  const a = await db.article.findUnique({ where: { id: articleId }, select: { authorId: true } });
  if (!a || !canViewArticleInAdmin(actor, a)) throw new ForbiddenError();
  const token = randomToken(24);
  await db.previewToken.create({ data: { tokenHash: sha256(token), articleId, createdById: actor.id, expiresAt: new Date(Date.now() + Math.min(hours, 168) * 3600_000) } });
  await audit({ actorId: actor.id, action: "article.preview_token", entityType: "Article", entityId: articleId, summary: { hours } });
  return token;
}

export async function bulkArticles(actor: Actor, ids: string[], op: "archive" | "noindex" | "index") {
  if (!can(actor, "article.bulk")) throw new ForbiddenError();
  const list = ids.slice(0, 100);
  if (op === "archive") {
    let n = 0;
    for (const id of list) {
      try {
        await transitionArticle(actor, id, "archive", { note: "bulk" });
        n++;
      } catch {
        /* skip ineligible */
      }
    }
    return n;
  }
  const res = await db.article.updateMany({ where: { id: { in: list } }, data: { robotsIndex: op === "index", version: { increment: 1 } } });
  await audit({ actorId: actor.id, action: `article.bulk_${op}`, entityType: "Article", summary: { count: res.count, ids: list } });
  for (const id of list) await revalidateArticleSurfaces(id);
  return res.count;
}
