"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { guarded, fdBool, fdStr } from "@/server/admin/helpers";
import type { FormResult } from "@/components/admin/action-form";
import { audit } from "@/server/security/audit";
import { slugify, isValidSlug } from "@/lib/utils/slug";
import { upsertRedirect } from "@/server/redirects";

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(60),
  slug: z.string().refine(isValidSlug, "Slug must be lower-case kebab-case"),
  description: z.string().max(400),
  intro: z.string().max(4000),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(300).optional(),
  parentId: z.string().optional(),
  icon: z.string().max(30).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  visible: z.boolean(),
  faq: z.array(z.object({ question: z.string().min(3).max(200), answer: z.string().min(3).max(1500) })).max(12),
});

/** FAQ entered as "Q: …" / "A: …" blocks separated by blank lines. */
function parseFaq(raw: string) {
  return raw
    .split(/\n\s*\n/)
    .map((b) => {
      const q = b.match(/^Q:\s*(.+)$/m)?.[1]?.trim();
      const a = b.match(/^A:\s*([\s\S]+)$/m)?.[1]?.trim();
      return q && a ? { question: q, answer: a } : null;
    })
    .filter(Boolean) as { question: string; answer: string }[];
}

export async function saveCategory(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("taxonomy.manage", async (user) => {
    const data = categorySchema.parse({
      id: fdStr(fd, "id") || undefined,
      name: fdStr(fd, "name"),
      slug: fdStr(fd, "slug") || slugify(fdStr(fd, "name")),
      description: fdStr(fd, "description"),
      intro: fdStr(fd, "intro"),
      seoTitle: fdStr(fd, "seoTitle") || undefined,
      seoDescription: fdStr(fd, "seoDescription") || undefined,
      parentId: fdStr(fd, "parentId") || undefined,
      icon: fdStr(fd, "icon") || undefined,
      sortOrder: fdStr(fd, "sortOrder") || 0,
      visible: fdBool(fd, "visible"),
      faq: parseFaq(fdStr(fd, "faq")),
    });
    if (data.parentId && data.parentId === data.id) throw Object.assign(new Error("A category can't be its own parent."), { status: 422 });
    const payload = {
      name: data.name,
      slug: data.slug,
      description: data.description,
      intro: data.intro,
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      parentId: data.parentId ?? null,
      icon: data.icon ?? null,
      sortOrder: data.sortOrder,
      visible: data.visible,
      faq: data.faq,
    };
    if (data.id) {
      const before = await db.category.findUniqueOrThrow({ where: { id: data.id } });
      await db.category.update({ where: { id: data.id }, data: payload });
      if (before.slug !== data.slug) await upsertRedirect({ fromPath: `/category/${before.slug}`, to: `/category/${data.slug}`, reason: "Category slug changed" });
      await audit({ actorId: user.id, action: "category.update", entityType: "Category", entityId: data.id, summary: { slug: data.slug } });
    } else {
      const c = await db.category.create({ data: payload });
      await audit({ actorId: user.id, action: "category.create", entityType: "Category", entityId: c.id, summary: { slug: c.slug } });
    }
    revalidatePath("/", "layout");
    return "Category saved.";
  });
}

export async function deleteCategory(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("taxonomy.manage", async (user) => {
    const id = fdStr(fd, "id");
    const used = await db.article.count({ where: { primaryCategoryId: id } });
    if (used) throw Object.assign(new Error(`${used} article(s) use this as their primary category. Move them first.`), { status: 409 });
    await db.category.delete({ where: { id } });
    await audit({ actorId: user.id, action: "category.delete", entityType: "Category", entityId: id });
    revalidatePath("/", "layout");
    return "Category deleted.";
  });
}

export async function saveTag(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("taxonomy.manage", async (user) => {
    const data = z
      .object({ id: z.string().optional(), name: z.string().min(2).max(40), slug: z.string().refine(isValidSlug, "Invalid slug"), description: z.string().max(300).optional() })
      .parse({ id: fdStr(fd, "id") || undefined, name: fdStr(fd, "name"), slug: fdStr(fd, "slug") || slugify(fdStr(fd, "name")), description: fdStr(fd, "description") || undefined });
    if (data.id) {
      const before = await db.tag.findUniqueOrThrow({ where: { id: data.id } });
      await db.tag.update({ where: { id: data.id }, data: { name: data.name, slug: data.slug, description: data.description ?? null } });
      if (before.slug !== data.slug) await upsertRedirect({ fromPath: `/tag/${before.slug}`, to: `/tag/${data.slug}`, reason: "Tag slug changed" });
    } else {
      const dup = await db.tag.findFirst({ where: { OR: [{ slug: data.slug }, { name: { equals: data.name, mode: "insensitive" } }] } });
      if (dup) throw Object.assign(new Error(`A tag “${dup.name}” already exists.`), { status: 409 });
      await db.tag.create({ data: { name: data.name, slug: data.slug, description: data.description ?? null } });
    }
    await audit({ actorId: user.id, action: data.id ? "tag.update" : "tag.create", entityType: "Tag", entityId: data.id ?? null, summary: { slug: data.slug } });
    revalidatePath("/admin/categories");
    return "Tag saved.";
  });
}

/** Merge tag A into tag B (fixes duplicates), then delete A and redirect its page. */
export async function mergeTags(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("taxonomy.manage", async (user) => {
    const from = fdStr(fd, "from");
    const into = fdStr(fd, "into");
    if (!from || !into || from === into) throw Object.assign(new Error("Choose two different tags."), { status: 422 });
    const [a, b] = await Promise.all([db.tag.findUniqueOrThrow({ where: { id: from } }), db.tag.findUniqueOrThrow({ where: { id: into } })]);
    await db.$transaction(async (tx) => {
      const links = await tx.articleTag.findMany({ where: { tagId: from } });
      for (const l of links) await tx.articleTag.upsert({ where: { articleId_tagId: { articleId: l.articleId, tagId: into } }, create: { articleId: l.articleId, tagId: into }, update: {} });
      await tx.tag.delete({ where: { id: from } });
      await upsertRedirect({ fromPath: `/tag/${a.slug}`, to: `/tag/${b.slug}`, reason: "Tag merged" }, tx);
    });
    await audit({ actorId: user.id, action: "tag.merge", entityType: "Tag", entityId: into, summary: { from: a.slug, into: b.slug } });
    revalidatePath("/admin/categories");
    return `Merged “${a.name}” into “${b.name}”.`;
  });
}

export async function deleteTag(_p: FormResult, fd: FormData): Promise<FormResult> {
  return guarded("taxonomy.manage", async (user) => {
    const id = fdStr(fd, "id");
    await db.tag.delete({ where: { id } });
    await audit({ actorId: user.id, action: "tag.delete", entityType: "Tag", entityId: id });
    revalidatePath("/admin/categories");
    return "Tag deleted.";
  });
}
