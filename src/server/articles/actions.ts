"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserOrThrow } from "@/lib/auth/session";
import { toResult, type ActionResult } from "@/lib/utils/result";
import { WORKFLOW_ACTIONS, articleInput } from "@/lib/schemas/article";
import { can, canViewArticleInAdmin, ForbiddenError } from "@/lib/permissions";
import { publishedWhere } from "./public";
import {
  bulkArticles,
  createDraft,
  createPreviewToken,
  duplicateAsDraft,
  restoreRevision,
  saveArticle,
  transitionArticle,
  ValidationError,
  type SaveResult,
} from "./admin";
import { runContentChecks, saveContentChecks, type CheckResult } from "./checks";
import { checkUrlHealth } from "@/server/security/safe-fetch";
import { rateLimit } from "@/server/security/rate-limit";
import { getSiteOrigin } from "@/lib/seo/urls";

const id = z.string().min(1).max(40);

export async function createArticleAction(formData: FormData) {
  const user = await requireUserOrThrow();
  const article = await createDraft(user, { title: String(formData.get("title") ?? "") });
  redirect(`/admin/articles/${article.id}/edit`);
}

export async function saveArticleAction(articleId: string, expectedVersion: number, payload: unknown, autosave: boolean): Promise<ActionResult<SaveResult>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    return saveArticle(user, id.parse(articleId), payload, { expectedVersion: z.number().int().parse(expectedVersion), autosave: Boolean(autosave) });
  });
}

export async function transitionArticleAction(articleId: string, action: string, opts: { scheduledAt?: string; timezone?: string; note?: string } = {}): Promise<ActionResult<{ status: string }>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    const parsedAction = z.enum(WORKFLOW_ACTIONS).parse(action);
    const o = z.object({ scheduledAt: z.string().max(40).optional(), timezone: z.string().max(64).optional(), note: z.string().max(300).optional() }).parse(opts);
    return transitionArticle(user, id.parse(articleId), parsedAction, o);
  });
}

export async function duplicateArticleAction(articleId: string): Promise<ActionResult<{ id: string }>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    const copy = await duplicateAsDraft(user, id.parse(articleId));
    return { id: copy.id };
  });
}

export async function restoreRevisionAction(articleId: string, revisionId: string): Promise<ActionResult<SaveResult>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    return restoreRevision(user, id.parse(articleId), id.parse(revisionId));
  });
}

export async function previewTokenAction(articleId: string): Promise<ActionResult<{ url: string }>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    const token = await createPreviewToken(user, id.parse(articleId));
    return { url: `${getSiteOrigin()}/preview/${token}` };
  });
}

export async function runChecksAction(articleId: string): Promise<ActionResult<CheckResult[]>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    const a = await db.article.findUnique({ where: { id: id.parse(articleId) }, select: { authorId: true } });
    if (!a || !canViewArticleInAdmin(user, a)) throw new ForbiddenError();
    const results = await runContentChecks(articleId);
    await saveContentChecks(articleId, results);
    return results;
  });
}

/** Manual link-health run for an article's references (rate-limited, SSRF-safe). */
export async function checkReferencesAction(articleId: string): Promise<ActionResult<{ url: string; status: number | null; error?: string }[]>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    const a = await db.article.findUnique({ where: { id: id.parse(articleId) }, select: { authorId: true, references: true } });
    if (!a || !canViewArticleInAdmin(user, a)) throw new ForbiddenError();
    const rl = await rateLimit(`linkcheck:${user.id}`, 10, 600);
    if (!rl.ok) throw Object.assign(new Error("Link checks are limited to 10 runs per 10 minutes."), { status: 429 });
    const out: { url: string; status: number | null; error?: string }[] = [];
    for (const r of a.references.slice(0, 40)) {
      const res = await checkUrlHealth(r.url);
      out.push({ url: r.url, status: res.status, error: res.error });
      await db.reference.update({ where: { id: r.id }, data: { lastStatus: res.status ?? 0, lastCheckedAt: new Date() } });
    }
    return out;
  });
}

/** Search-select for related articles: published only, never self. */
export async function searchRelatedAction(query: string, excludeId: string): Promise<{ id: string; title: string; slug: string }[]> {
  await requireUserOrThrow();
  const q = String(query).trim().slice(0, 80);
  return db.article.findMany({
    where: { ...publishedWhere(), NOT: { id: excludeId }, ...(q ? { title: { contains: q, mode: "insensitive" } } : {}) },
    select: { id: true, title: true, slug: true },
    take: 8,
    orderBy: { firstPublishedAt: "desc" },
  });
}

/** Suggest related articles from shared tags/category — editor approves each one. */
export async function suggestRelatedAction(articleId: string): Promise<{ id: string; title: string; slug: string; reason: string }[]> {
  await requireUserOrThrow();
  const a = await db.article.findUnique({ where: { id: articleId }, select: { primaryCategoryId: true, tags: { select: { tagId: true } } } });
  if (!a) return [];
  const tagIds = a.tags.map((t) => t.tagId);
  const rows = await db.article.findMany({
    where: { ...publishedWhere(), NOT: { id: articleId }, OR: [{ primaryCategoryId: a.primaryCategoryId }, ...(tagIds.length ? [{ tags: { some: { tagId: { in: tagIds } } } }] : [])] },
    select: { id: true, title: true, slug: true, primaryCategoryId: true, tags: { select: { tagId: true } } },
    take: 30,
  });
  return rows
    .map((r) => {
      const shared = r.tags.filter((t) => tagIds.includes(t.tagId)).length;
      const score = shared * 2 + (r.primaryCategoryId === a.primaryCategoryId ? 1 : 0);
      return { id: r.id, title: r.title, slug: r.slug, score, reason: shared ? `${shared} shared tag${shared > 1 ? "s" : ""}` : "same category" };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 6)
    .map(({ score: _s, ...rest }) => (void _s, rest));
}

export async function bulkArticlesAction(ids: string[], op: string): Promise<ActionResult<{ count: number }>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    if (!can(user, "article.bulk")) throw new ForbiddenError();
    const parsed = z.object({ ids: z.array(id).min(1).max(100), op: z.enum(["archive", "noindex", "index"]) }).parse({ ids, op });
    return { count: await bulkArticles(user, parsed.ids, parsed.op) };
  });
}

/**
 * /admin/articles/new: the first save validates everything up front, then creates
 * the draft and persists all fields — so a failed first save never leaves an orphan draft.
 */
export async function createArticleWithContentAction(payload: unknown): Promise<ActionResult<SaveResult>> {
  return toResult(async () => {
    const user = await requireUserOrThrow();
    const raw: Record<string, unknown> = { ...((payload ?? {}) as Record<string, unknown>), authorId: user.id };
    const precheck = articleInput.safeParse({ ...raw, slug: raw.slug || "placeholder-slug" });
    if (!precheck.success) {
      const fe: Record<string, string> = {};
      for (const i of precheck.error.issues) fe[i.path.join(".")] ??= i.message;
      throw new ValidationError("Some fields need attention.", fe);
    }
    const draft = await createDraft(user, { title: precheck.data.title, categoryId: precheck.data.primaryCategoryId });
    return saveArticle(user, draft.id, { ...raw, slug: (raw.slug as string) || draft.slug }, { expectedVersion: draft.version, autosave: false, revisionSummary: "Created" });
  });
}
