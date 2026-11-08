import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

/**
 * Invalidate every cached public surface an article appears on. Called after
 * publish, unpublish, update of a published article, scheduled publication and
 * slug changes. Safe to call outside a request (e.g. from the cron route).
 */
export async function revalidateArticleSurfaces(articleId: string, extraSlugs: string[] = []) {
  const a = await db.article.findUnique({
    where: { id: articleId },
    select: {
      slug: true,
      primaryCategory: { select: { slug: true } },
      secondaryCategories: { select: { category: { select: { slug: true } } } },
      tags: { select: { tag: { select: { slug: true } } } },
      author: { select: { profile: { select: { slug: true } } } },
      relatedTo: { select: { article: { select: { slug: true } } } },
    },
  });
  const paths = new Set<string>(["/", "/guides", "/sitemap.xml", "/search"]);
  if (a) {
    paths.add(`/guides/${a.slug}`);
    paths.add(`/category/${a.primaryCategory.slug}`);
    a.secondaryCategories.forEach((c) => paths.add(`/category/${c.category.slug}`));
    a.tags.forEach((t) => paths.add(`/tag/${t.tag.slug}`));
    if (a.author.profile) paths.add(`/authors/${a.author.profile.slug}`);
    // Articles that list this one as related show its title/excerpt.
    a.relatedTo.forEach((r) => paths.add(`/guides/${r.article.slug}`));
  }
  extraSlugs.forEach((s) => paths.add(`/guides/${s}`));
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch (e) {
      console.warn("[revalidate] failed", p, (e as Error).message);
    }
  }
  try {
    // Header/footer category counts live in every layout.
    revalidatePath("/", "layout");
  } catch {
    /* ignore */
  }
}
