import "server-only";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions";
import { can, canEditArticle } from "@/lib/permissions";
import { sanitizeDoc, EMPTY_DOC } from "@/lib/content/schema";
import { getSiteOrigin } from "@/lib/seo/urls";
import { getSettings } from "@/server/settings";
import { storageDriver } from "@/server/media/storage";
import { availableActions } from "./workflow";
import type { EditorForm, EditorProps } from "@/components/admin/editor/article-editor";
import type { EditorArticle } from "./admin";
import type { CheckResult } from "./checks";

const d = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : "");

async function shared(actor: Actor) {
  const [categories, tags, users, settings] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true, profile: { select: { isPublic: true, bio: true } } } }),
    getSettings(),
  ]);
  return {
    categories,
    tags,
    users: users.map((u) => ({ id: u.id, name: u.name, role: u.role, publicProfile: Boolean(u.profile?.isPublic && u.profile.bio) })),
    siteOrigin: getSiteOrigin(),
    titleSuffix: settings.seo.defaultTitleSuffix,
    brandName: settings.brand.name,
    presignedUploads: storageDriver() === "s3",
    perms: { editAny: can(actor, "article.editAny"), review: can(actor, "article.review"), canonical: can(actor, "settings.manage"), readOnly: false },
  };
}

export async function newEditorProps(actor: Actor): Promise<EditorProps> {
  const s = await shared(actor);
  const initial: EditorForm = {
    title: "",
    slug: "",
    excerpt: "",
    primaryCategoryId: s.categories[0]?.id ?? "",
    secondaryCategoryIds: [],
    tagIds: [],
    newTags: [],
    cover: null,
    ogImage: null,
    bodyJson: EMPTY_DOC,
    type: "TROUBLESHOOTING",
    schemaType: "BLOG_POSTING",
    visibility: "PUBLIC",
    related: [],
    authorId: actor.id,
    reviewerId: "",
    testedEnvironment: [],
    verification: { stepsVerified: false, originalScreenshots: false, claimsSourced: false },
    references: [],
    lastVerifiedAt: "",
    markMaterialUpdate: false,
    correctionsNote: "",
    revisionReason: "",
    affiliateDisclosureFlag: false,
    affiliateDisclosureText: "",
    metaTitle: "",
    metaDescription: "",
    searchIntent: "",
    secondaryQueries: [],
    canonicalOverride: "",
    robotsIndex: true,
    robotsFollow: true,
    ogTitle: "",
    ogDescription: "",
    featuredOnHome: false,
    featuredRank: "",
    pinnedUntil: "",
    brief: { queryIntent: "", competitorNotes: "", unmetNeeds: "", experiment: "", difficulty: "" },
    createRedirectOnSlugChange: true,
  };
  return { ...s, mode: "new", articleId: null, version: 0, status: "DRAFT", publishedSlug: null, firstPublishedAt: null, scheduledAt: null, initial, checks: [], actions: [], lastSavedAt: null, revisionCount: 0 };
}

export async function editEditorProps(actor: Actor, a: EditorArticle): Promise<EditorProps> {
  const s = await shared(actor);
  const brief = (a.brief ?? {}) as Partial<EditorForm["brief"]>;
  const verification = (a.verification ?? {}) as Partial<EditorForm["verification"]>;
  const media = (m: EditorArticle["coverMedia"]) => (m ? { id: m.id, fileUrl: m.fileUrl, alt: m.alt, width: m.width, height: m.height } : null);
  const revisionCount = await db.articleRevision.count({ where: { articleId: a.id } });
  const initial: EditorForm = {
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    primaryCategoryId: a.primaryCategoryId,
    secondaryCategoryIds: a.secondaryCategories.map((c) => c.categoryId),
    tagIds: a.tags.map((t) => t.tagId),
    newTags: [],
    cover: media(a.coverMedia),
    ogImage: media(a.ogImage),
    bodyJson: sanitizeDoc(a.bodyJson),
    type: a.type,
    schemaType: a.schemaType,
    visibility: a.visibility,
    related: a.related.map((r) => ({ id: r.related.id, title: r.related.title, slug: r.related.slug })),
    authorId: a.authorId,
    reviewerId: a.reviewerId ?? "",
    testedEnvironment: (Array.isArray(a.testedEnvironment) ? a.testedEnvironment : []) as EditorForm["testedEnvironment"],
    verification: { stepsVerified: Boolean(verification.stepsVerified), originalScreenshots: Boolean(verification.originalScreenshots), claimsSourced: Boolean(verification.claimsSourced) },
    references: a.references.map((r) => ({ title: r.title, url: r.url, publisher: r.publisher ?? "", accessedAt: d(r.accessedAt), referenceType: r.referenceType, isPrimary: r.isPrimary })),
    lastVerifiedAt: d(a.lastVerifiedAt),
    markMaterialUpdate: false,
    correctionsNote: a.correctionsNote ?? "",
    revisionReason: "",
    affiliateDisclosureFlag: a.affiliateDisclosureFlag,
    affiliateDisclosureText: a.affiliateDisclosureText ?? "",
    metaTitle: a.metaTitle ?? "",
    metaDescription: a.metaDescription ?? "",
    searchIntent: a.searchIntent ?? "",
    secondaryQueries: a.secondaryQueries,
    canonicalOverride: a.canonicalOverride ?? "",
    robotsIndex: a.robotsIndex,
    robotsFollow: a.robotsFollow,
    ogTitle: a.ogTitle ?? "",
    ogDescription: a.ogDescription ?? "",
    featuredOnHome: a.featuredOnHome,
    featuredRank: a.featuredRank ? String(a.featuredRank) : "",
    pinnedUntil: d(a.pinnedUntil),
    brief: { queryIntent: brief.queryIntent ?? "", competitorNotes: brief.competitorNotes ?? "", unmetNeeds: brief.unmetNeeds ?? "", experiment: brief.experiment ?? "", difficulty: brief.difficulty ?? "" },
    createRedirectOnSlugChange: true,
  };
  const checks: CheckResult[] = a.checks.map((c) => ({ checkType: c.checkType, severity: c.severity, message: String((c.resultJson as { message?: string })?.message ?? c.checkType) }));
  return {
    ...s,
    perms: { ...s.perms, readOnly: !canEditArticle(actor, a) },
    mode: "edit",
    articleId: a.id,
    version: a.version,
    status: a.status,
    publishedSlug: a.firstPublishedAt ? a.slug : null,
    firstPublishedAt: a.firstPublishedAt?.toISOString() ?? null,
    scheduledAt: a.scheduledAt?.toISOString() ?? null,
    initial,
    checks,
    actions: availableActions(actor, a),
    lastSavedAt: a.updatedAt.toISOString(),
    revisionCount,
  };
}
