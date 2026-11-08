import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getPublishedArticle, listPublished, searchPublished, getCategoriesWithCounts } from "@/server/articles/public";
import { saveArticle, transitionArticle, publishDueArticles, restoreRevision, ConflictError } from "@/server/articles/admin";
import { ForbiddenError } from "@/lib/permissions";
import sitemap from "@/app/sitemap";
import { makeArticle, makeCategory, makeUser, bodyWithWords } from "../support/factories";

async function editorPayload(id: string, over: Record<string, unknown> = {}) {
  const a = await db.article.findUniqueOrThrow({ where: { id } });
  return {
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt || "Excerpt.",
    primaryCategoryId: a.primaryCategoryId,
    bodyJson: a.bodyJson,
    type: a.type,
    schemaType: a.schemaType,
    visibility: a.visibility,
    authorId: a.authorId,
    ...over,
  };
}

describe("public read model never leaks unpublished content", () => {
  it("hides drafts, scheduled, private and archived articles everywhere", async () => {
    const cat = await makeCategory();
    const live = await makeArticle({ status: "PUBLISHED", categoryId: cat.id, title: "Visible kubernetes guide", words: 50 });
    const hidden = await Promise.all([
      makeArticle({ status: "DRAFT", categoryId: cat.id, title: "Secret kubernetes draft", words: 50 }),
      makeArticle({ status: "SCHEDULED", categoryId: cat.id, title: "Future kubernetes post", scheduledAt: new Date(Date.now() + 3600_000), words: 50 }),
      makeArticle({ status: "ARCHIVED", categoryId: cat.id, title: "Old kubernetes post", words: 50 }),
    ]);
    const priv = await makeArticle({ status: "PUBLISHED", visibility: "PRIVATE", categoryId: cat.id, title: "Private kubernetes post", words: 50 });

    for (const h of [...hidden, priv]) expect(await getPublishedArticle(h.slug)).toBeNull();
    expect(await getPublishedArticle(live.slug)).not.toBeNull();

    const list = await listPublished({ categoryId: cat.id });
    expect(list.items.map((i) => i.id)).toEqual([live.id]);

    const search = await searchPublished("kubernetes");
    expect(search.hits.map((h) => h.id)).toEqual([live.id]);

    const counts = await getCategoriesWithCounts();
    expect(counts.find((c) => c.id === cat.id)?.count).toBe(1);

    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`https://fixlayer.test/guides/${live.slug}`);
    for (const h of [...hidden, priv]) expect(urls).not.toContain(`https://fixlayer.test/guides/${h.slug}`);
  });

  it("search handles hostile input without throwing", async () => {
    for (const q of ["'); DROP TABLE articles; --", '"unclosed', "!!!&|:*", "a".repeat(5000), "\u0000\u0001", "-", "or"]) {
      await expect(searchPublished(q)).resolves.toBeDefined();
    }
    expect((await db.article.count()) > 0).toBe(true);
  });
});

describe("saving articles", () => {
  it("blocks authors from editing someone else's article (IDOR)", async () => {
    const owner = await makeUser("AUTHOR");
    const intruder = await makeUser("AUTHOR");
    const a = await makeArticle({ authorId: owner.id });
    await expect(saveArticle(intruder, a.id, await editorPayload(a.id, { title: "Hacked" }), { expectedVersion: a.version, autosave: false })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.article.findUniqueOrThrow({ where: { id: a.id } })).title).not.toBe("Hacked");
  });

  it("rejects stale versions (optimistic concurrency)", async () => {
    const ed = await makeUser("EDITOR");
    const a = await makeArticle({ authorId: ed.id });
    await saveArticle(ed, a.id, await editorPayload(a.id, { title: "First" }), { expectedVersion: a.version, autosave: true });
    await expect(saveArticle(ed, a.id, await editorPayload(a.id, { title: "Stale" }), { expectedVersion: a.version, autosave: true })).rejects.toBeInstanceOf(ConflictError);
  });

  it("sanitizes XSS in the body before storing", async () => {
    const ed = await makeUser("EDITOR");
    const a = await makeArticle({ authorId: ed.id });
    const evil = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }, { type: "script", content: [] }] };
    await saveArticle(ed, a.id, await editorPayload(a.id, { bodyJson: evil }), { expectedVersion: a.version, autosave: false });
    const stored = JSON.stringify((await db.article.findUniqueOrThrow({ where: { id: a.id } })).bodyJson);
    expect(stored).not.toContain("javascript");
    expect(stored).not.toContain("script");
  });

  it("changing a published slug creates one 301 hop and collapses chains", async () => {
    const ed = await makeUser("EDITOR", { publicProfile: true });
    const a = await makeArticle({ authorId: ed.id, status: "PUBLISHED", slug: `slug-a-${Date.now()}`, words: 100 });
    const s0 = a.slug;
    let r = await saveArticle(ed, a.id, await editorPayload(a.id, { slug: `${s0}-b` }), { expectedVersion: a.version, autosave: false });
    expect(r.redirectCreated).toBe(`/guides/${s0}`);
    r = await saveArticle(ed, a.id, await editorPayload(a.id, { slug: `${s0}-c` }), { expectedVersion: r.version, autosave: false });
    const rules = await db.redirect.findMany({ where: { fromPath: { in: [`/guides/${s0}`, `/guides/${s0}-b`] } } });
    expect(rules).toHaveLength(2);
    for (const rule of rules) expect(rule.toPathOrUrl).toBe(`/guides/${s0}-c`);
  });

  it("restores a revision but keeps the current slug", async () => {
    const ed = await makeUser("EDITOR");
    const a = await makeArticle({ authorId: ed.id, title: "Original title" });
    const r1 = await saveArticle(ed, a.id, await editorPayload(a.id), { expectedVersion: a.version, autosave: false });
    const rev = await db.articleRevision.findFirstOrThrow({ where: { articleId: a.id }, orderBy: { version: "desc" } });
    await saveArticle(ed, a.id, await editorPayload(a.id, { title: "Changed title" }), { expectedVersion: r1.version, autosave: false });
    await restoreRevision(ed, a.id, rev.id);
    expect((await db.article.findUniqueOrThrow({ where: { id: a.id } })).title).toBe("Original title");
    expect(await db.auditLog.count({ where: { entityId: a.id, action: "article.restore_revision" } })).toBe(1);
  });
});

describe("workflow & scheduling", () => {
  it("authors cannot publish; editors can once the article is ready", async () => {
    const au = await makeUser("AUTHOR", { publicProfile: true });
    const ed = await makeUser("EDITOR", { publicProfile: true });
    const a = await makeArticle({ authorId: au.id });
    await expect(transitionArticle(au, a.id, "publish")).rejects.toBeInstanceOf(ForbiddenError);
    await transitionArticle(au, a.id, "submit");
    await expect(transitionArticle(ed, a.id, "publish")).rejects.toThrow(/Not ready/);
    await db.article.update({ where: { id: a.id }, data: { bodyJson: bodyWithWords(400) } });
    await transitionArticle(ed, a.id, "publish");
    const after = await db.article.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.status).toBe("PUBLISHED");
    expect(after.firstPublishedAt).not.toBeNull();
    expect(after.reviewerId).toBe(ed.id);
  });

  it("publishes a due scheduled article exactly once under concurrent cron runs", async () => {
    const a = await makeArticle({ status: "SCHEDULED", scheduledAt: new Date(Date.now() - 1000), words: 100 });
    const runs = await Promise.all([publishDueArticles(), publishDueArticles(), publishDueArticles()]);
    expect(runs.flat().filter((id) => id === a.id)).toHaveLength(1);
    expect((await db.article.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("PUBLISHED");
    expect(await db.auditLog.count({ where: { entityId: a.id, action: "article.scheduled_publish" } })).toBe(1);
  });

  it("refuses to schedule in the past", async () => {
    const ed = await makeUser("EDITOR", { publicProfile: true });
    const a = await makeArticle({ authorId: ed.id, words: 400 });
    await db.article.update({ where: { id: a.id }, data: { bodyJson: bodyWithWords(400) } });
    await expect(transitionArticle(ed, a.id, "schedule", { scheduledAt: new Date(Date.now() - 60_000).toISOString() })).rejects.toThrow(/future/);
  });
});
