import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getCategoriesWithCounts, publishedWhere, effectiveUpdated } from "@/server/articles/public";
import { getSettings } from "@/server/settings";
import { absoluteUrl } from "@/lib/seo/urls";
import { TOOLS } from "@/components/tools/registry";

export const revalidate = 3600;

/**
 * Only canonical, published, indexable URLs. Excluded: drafts, previews, admin,
 * search, paginated pages, noindexed articles, articles whose canonical points
 * elsewhere, empty categories and thin tag pages.
 * One file holds up to 50,000 URLs; past ~45k switch to generateSitemaps() (see docs/SEO.md).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [s, articles, categories] = await Promise.all([
    getSettings(),
    db.article.findMany({
      where: { ...publishedWhere(), robotsIndex: true, canonicalOverride: null },
      select: { slug: true, firstPublishedAt: true, materiallyUpdatedAt: true, authorId: true },
      orderBy: { firstPublishedAt: "desc" },
      take: 45_000,
    }),
    getCategoriesWithCounts(),
  ]);
  const latest = articles.map(effectiveUpdated).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? undefined;

  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: latest },
    { url: absoluteUrl("/guides"), lastModified: latest },
    { url: absoluteUrl("/tools") },
    ...TOOLS.map((t) => ({ url: absoluteUrl(`/tools/${t.slug}`) })),
    { url: absoluteUrl("/about") },
    { url: absoluteUrl("/contact") },
    { url: absoluteUrl("/editorial-policy") },
    { url: absoluteUrl("/corrections-policy") },
    { url: absoluteUrl("/affiliate-disclosure") },
    { url: absoluteUrl("/privacy-policy") },
    { url: absoluteUrl("/terms") },
  ];

  for (const c of categories) if (c.count > 0) entries.push({ url: absoluteUrl(`/category/${c.slug}`) });

  for (const a of articles) entries.push({ url: absoluteUrl(`/guides/${a.slug}`), lastModified: effectiveUpdated(a) ?? undefined });

  if (s.seo.includeAuthorPagesInSitemap) {
    const authorIds = [...new Set(articles.map((a) => a.authorId))];
    const authors = await db.authorProfile.findMany({ where: { userId: { in: authorIds }, isPublic: true }, select: { slug: true } });
    for (const au of authors) entries.push({ url: absoluteUrl(`/authors/${au.slug}`) });
  }

  if (s.seo.includeTagPagesInSitemap) {
    const tags = await db.tag.findMany({
      where: { articles: { some: { article: publishedWhere() } } },
      select: { slug: true, _count: { select: { articles: { where: { article: publishedWhere() } } } } },
    });
    for (const t of tags) if (t._count.articles >= 3) entries.push({ url: absoluteUrl(`/tag/${t.slug}`) });
  }

  return entries;
}
