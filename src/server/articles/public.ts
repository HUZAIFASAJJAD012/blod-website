import "server-only";
import { cache } from "react";
import { db, Prisma } from "@/lib/db";

/**
 * Public read model. EVERY public query must go through `publishedWhere()` so a
 * draft, scheduled, archived or private article can never leak — not via the
 * page, search, sitemap, feeds, related links or category counts.
 */
export function publishedWhere(now = new Date()): Prisma.ArticleWhereInput {
  return { status: "PUBLISHED", visibility: "PUBLIC", firstPublishedAt: { lte: now } };
}

const cardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  type: true,
  firstPublishedAt: true,
  materiallyUpdatedAt: true,
  readingMinutes: true,
  primaryCategory: { select: { name: true, slug: true } },
  author: { select: { name: true, profile: { select: { slug: true, isPublic: true } } } },
  coverMedia: { select: { fileUrl: true, alt: true, width: true, height: true } },
} satisfies Prisma.ArticleSelect;

export type ArticleCard = Prisma.ArticleGetPayload<{ select: typeof cardSelect }>;

export function articleViewInclude(now = new Date()) {
  return {
    primaryCategory: true,
    secondaryCategories: { include: { category: true } },
    author: { select: { id: true, name: true, profile: true, image: { select: { fileUrl: true, alt: true } } } },
    reviewer: { select: { id: true, name: true, profile: { select: { slug: true, isPublic: true, roleTitle: true } } } },
    coverMedia: true,
    ogImage: true,
    tags: { include: { tag: true } },
    references: { orderBy: { sortOrder: "asc" } },
    related: {
      orderBy: { sortOrder: "asc" },
      where: { related: publishedWhere(now) },
      include: { related: { select: cardSelect } },
    },
  } satisfies Prisma.ArticleInclude;
}

export const getPublishedArticle = cache(async (slug: string) => {
  return db.article.findFirst({ where: { slug, ...publishedWhere() }, include: articleViewInclude() });
});

export type PublicArticle = Prisma.ArticleGetPayload<{ include: ReturnType<typeof articleViewInclude> }>;

export async function listPublished(opts: {
  page?: number;
  perPage?: number;
  categoryId?: string;
  tagId?: string;
  authorId?: string;
  excludeIds?: string[];
}) {
  const perPage = Math.min(opts.perPage ?? 12, 48);
  const page = Math.max(1, Math.min(opts.page ?? 1, 500));
  const where: Prisma.ArticleWhereInput = {
    ...publishedWhere(),
    ...(opts.categoryId
      ? { OR: [{ primaryCategoryId: opts.categoryId }, { secondaryCategories: { some: { categoryId: opts.categoryId } } }] }
      : {}),
    ...(opts.tagId ? { tags: { some: { tagId: opts.tagId } } } : {}),
    ...(opts.authorId ? { authorId: opts.authorId } : {}),
    ...(opts.excludeIds?.length ? { id: { notIn: opts.excludeIds } } : {}),
  };
  const [items, total] = await Promise.all([
    db.article.findMany({
      where,
      select: cardSelect,
      orderBy: [{ firstPublishedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.article.count({ where }),
  ]);
  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/** Sort key for "recently updated": material update if any, else first publication. */
export function effectiveUpdated(a: { firstPublishedAt: Date | null; materiallyUpdatedAt: Date | null }): Date | null {
  if (a.materiallyUpdatedAt && a.firstPublishedAt && a.materiallyUpdatedAt > a.firstPublishedAt) return a.materiallyUpdatedAt;
  return a.firstPublishedAt;
}

export async function getHomepageData() {
  const now = new Date();
  const [featured, recent, categories, total] = await Promise.all([
    db.article.findMany({
      where: { ...publishedWhere(now), featuredOnHome: true },
      select: cardSelect,
      orderBy: [{ featuredRank: { sort: "asc", nulls: "last" } }, { firstPublishedAt: "desc" }],
      take: 6,
    }),
    db.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "articles"
      WHERE "status" = 'PUBLISHED' AND "visibility" = 'PUBLIC' AND "firstPublishedAt" <= ${now}
      ORDER BY GREATEST("firstPublishedAt", COALESCE("materiallyUpdatedAt", "firstPublishedAt")) DESC
      LIMIT 5`,
    getCategoriesWithCounts(),
    db.article.count({ where: publishedWhere(now) }),
  ]);
  const recentCards = recent.length
    ? await db.article.findMany({ where: { id: { in: recent.map((r) => r.id) } }, select: cardSelect })
    : [];
  const order = new Map(recent.map((r, i) => [r.id, i]));
  recentCards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  // "Most useful": editor-curated (featured) first, then pinned-until-date items. We do not
  // fabricate popularity; first-party view counts are only used if explicitly enabled.
  const recentIds = new Set(recentCards.map((r) => r.id));
  const useful = featured.filter((f) => !recentIds.has(f.id)).slice(0, 3);
  if (useful.length < 3) {
    const fill = await db.article.findMany({
      where: { ...publishedWhere(now), id: { notIn: [...recentIds, ...useful.map((u) => u.id)] } },
      select: cardSelect,
      orderBy: [{ pinnedUntil: { sort: "desc", nulls: "last" } }, { firstPublishedAt: "asc" }],
      take: 3 - useful.length,
    });
    useful.push(...fill);
  }
  return { featured, recent: recentCards, useful, categories, total };
}

export const getCategoriesWithCounts = cache(async () => {
  const now = new Date();
  const cats = await db.category.findMany({
    where: { visible: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, description: true, icon: true, parentId: true },
  });
  const counts = await db.$queryRaw<{ categoryId: string; n: bigint }[]>`
    SELECT c."id" AS "categoryId", COUNT(DISTINCT a."id") AS n
    FROM "categories" c
    LEFT JOIN "article_categories" ac ON ac."categoryId" = c."id"
    LEFT JOIN "articles" a ON (a."primaryCategoryId" = c."id" OR a."id" = ac."articleId")
      AND a."status" = 'PUBLISHED' AND a."visibility" = 'PUBLIC' AND a."firstPublishedAt" <= ${now}
    GROUP BY c."id"`;
  const byId = new Map(counts.map((c) => [c.categoryId, Number(c.n)]));
  return cats.map((c) => ({ ...c, count: byId.get(c.id) ?? 0 }));
});

export const getCategoryBySlug = cache(async (slug: string) =>
  db.category.findFirst({ where: { slug, visible: true }, include: { featuredMedia: true, parent: true } }),
);

export const getPublicAuthor = cache(async (slug: string) =>
  db.authorProfile.findFirst({
    where: { slug, isPublic: true, user: { status: "ACTIVE" } },
    include: { user: { select: { id: true, name: true, image: { select: { fileUrl: true, alt: true } } } } },
  }),
);

export type SearchHit = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  headline: string;
  categoryName: string;
  categorySlug: string;
  firstPublishedAt: Date;
  rank: number;
};

/**
 * Postgres full-text search. `websearch_to_tsquery` safely parses user input
 * (quotes, -exclusions, OR) and never throws on odd syntax; all values are bound
 * parameters. ts_headline output is re-escaped before display (see search page).
 */
export async function searchPublished(rawQuery: string, page = 1, perPage = 10) {
  const q = rawQuery.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120);
  if (q.length < 2) return { hits: [] as SearchHit[], total: 0, query: q };
  const now = new Date();
  const offset = (Math.max(1, Math.min(page, 50)) - 1) * perPage;
  const [hits, totalRows] = await Promise.all([
    db.$queryRaw<SearchHit[]>`
      SELECT a."id", a."title", a."slug", a."excerpt", a."firstPublishedAt",
             c."name" AS "categoryName", c."slug" AS "categorySlug",
             ts_rank_cd(a."searchVector", query) AS rank,
             ts_headline('english', a."bodyText", query,
               'StartSel=[[[, StopSel=]]], MaxWords=28, MinWords=12, MaxFragments=1, FragmentDelimiter= … ') AS headline
      FROM "articles" a
      JOIN "categories" c ON c."id" = a."primaryCategoryId",
           websearch_to_tsquery('english', ${q}) query
      WHERE a."searchVector" @@ query
        AND a."status" = 'PUBLISHED' AND a."visibility" = 'PUBLIC' AND a."firstPublishedAt" <= ${now}
      ORDER BY rank DESC, a."firstPublishedAt" DESC
      LIMIT ${perPage} OFFSET ${offset}`,
    db.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM "articles" a, websearch_to_tsquery('english', ${q}) query
      WHERE a."searchVector" @@ query
        AND a."status" = 'PUBLISHED' AND a."visibility" = 'PUBLIC' AND a."firstPublishedAt" <= ${now}`,
  ]);
  return { hits, total: Number(totalRows[0]?.n ?? 0), query: q };
}

/** Title-prefix suggestions for the search box (published only, tiny payload). */
export async function suggestPublished(rawQuery: string) {
  const q = rawQuery.trim().slice(0, 60);
  if (q.length < 2) return [];
  return db.article.findMany({
    where: { ...publishedWhere(), title: { contains: q, mode: "insensitive" } },
    select: { title: true, slug: true },
    take: 6,
    orderBy: { firstPublishedAt: "desc" },
  });
}
