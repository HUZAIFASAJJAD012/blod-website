import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { EMPTY_DOC } from "@/lib/content/schema";

let n = 0;
const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

export async function makeUser(role: Role = "AUTHOR", opts: { publicProfile?: boolean } = {}) {
  const id = uid();
  const user = await db.user.create({ data: { name: `User ${id}`, email: `u-${id}@test.local`, role, status: "ACTIVE" } });
  await db.authorProfile.create({ data: { userId: user.id, slug: `user-${id}`, bio: opts.publicProfile ? "A real person who writes and tests these guides on real servers." : "", isPublic: Boolean(opts.publicProfile) } });
  return user;
}

export async function makeCategory() {
  const id = uid();
  return db.category.create({ data: { name: `Cat ${id}`, slug: `cat-${id}` } });
}

export function bodyWithWords(words: number, extra: object[] = []) {
  const text = Array.from({ length: words }, (_, i) => `word${i}`).join(" ");
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }, { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Fix it" }] }, ...extra] };
}

export async function makeArticle(over: Partial<{ status: "DRAFT" | "PUBLISHED" | "SCHEDULED" | "IN_REVIEW" | "ARCHIVED"; authorId: string; categoryId: string; title: string; slug: string; scheduledAt: Date; visibility: "PUBLIC" | "PRIVATE"; words: number }> = {}) {
  const id = uid();
  const author = over.authorId ?? (await makeUser("EDITOR", { publicProfile: true })).id;
  const cat = over.categoryId ?? (await makeCategory()).id;
  const body = over.words ? bodyWithWords(over.words) : EMPTY_DOC;
  return db.article.create({
    data: {
      title: over.title ?? `Article ${id}`,
      slug: over.slug ?? `article-${id}`,
      excerpt: "An excerpt that explains the fix.",
      bodyJson: body as object,
      bodyText: over.words ? Array.from({ length: over.words }, (_, i) => `word${i}`).join(" ") : "",
      primaryCategoryId: cat,
      authorId: author,
      status: over.status ?? "DRAFT",
      visibility: over.visibility ?? "PUBLIC",
      scheduledAt: over.scheduledAt,
      firstPublishedAt: over.status === "PUBLISHED" ? new Date(Date.now() - 60_000) : null,
    },
  });
}
