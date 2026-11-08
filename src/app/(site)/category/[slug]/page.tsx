import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirectIfManaged } from "@/server/redirects";
import { db } from "@/lib/db";
import { getCategoryBySlug, listPublished, publishedWhere } from "@/server/articles/public";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHeader } from "@/components/site/page-header";
import { GridArticleCard, ListArticleRow } from "@/components/article/article-cards";
import { Pagination, parsePage } from "@/components/site/pagination";

type Faq = { question: string; answer: string };

async function load(slug: string, page: number) {
  const category = await getCategoryBySlug(slug);
  if (!category) return null;
  const [feed, curated, children] = await Promise.all([
    listPublished({ categoryId: category.id, page, perPage: 12 }),
    page === 1
      ? db.article.findMany({
          where: { ...publishedWhere(), primaryCategoryId: category.id, featuredRank: { not: null } },
          orderBy: { featuredRank: "asc" },
          take: 3,
          select: {
            id: true, title: true, slug: true, excerpt: true, type: true, firstPublishedAt: true, materiallyUpdatedAt: true, readingMinutes: true,
            primaryCategory: { select: { name: true, slug: true } },
            author: { select: { name: true, profile: { select: { slug: true, isPublic: true } } } },
            coverMedia: { select: { fileUrl: true, alt: true, width: true, height: true } },
          },
        })
      : Promise.resolve([]),
    db.category.findMany({ where: { parentId: category.id, visible: true }, orderBy: { sortOrder: "asc" }, select: { name: true, slug: true } }),
  ]);
  return { category, feed, curated, children };
}

export async function generateMetadata({ params, searchParams }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = parsePage((await searchParams).page) ?? 1;
  const data = await load(slug, page);
  if (!data) return {};
  const s = await getSettings();
  const { category, feed } = data;
  return buildMetadata({
    title: `${category.seoTitle || `${category.name} troubleshooting guides`}${page > 1 ? ` — page ${page}` : ""} | ${s.brand.name}`,
    description: category.seoDescription || category.description,
    path: page > 1 ? `/category/${slug}?page=${page}` : `/category/${slug}`,
    // Empty topic pages are thin content: keep them out of the index until they have guides.
    index: feed.total > 0,
    siteName: s.brand.name,
  });
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const page = parsePage((await searchParams).page);
  if (!page) notFound();
  const data = await load(slug, page);
  if (!data) {
    await redirectIfManaged(`/category/${slug}`);
    notFound();
  }
  const { category, feed, curated, children } = data;
  if (page > feed.pageCount) notFound();
  const faq = (Array.isArray(category.faq) ? category.faq : []) as Faq[];
  const curatedIds = new Set(curated.map((c) => c.id));

  return (
    <>
      <PageHeader
        crumbs={[...(category.parent ? [{ name: category.parent.name, path: `/category/${category.parent.slug}` }] : []), { name: category.name, path: `/category/${category.slug}` }]}
        eyebrow={`${feed.total} ${feed.total === 1 ? "guide" : "guides"}`}
        title={category.name}
        lead={category.description}
      >
        {children.length ? (
          <ul className="mt-6 flex flex-wrap gap-2">
            {children.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="chip">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </PageHeader>

      <div className="container-page">
        {page === 1 && category.intro ? (
          <div className="prose-article mb-12 max-w-[730px] whitespace-pre-line">{category.intro}</div>
        ) : null}

        {curated.length ? (
          <section aria-labelledby="best" className="mb-14">
            <h2 id="best" className="h2-section mb-6">
              Start with these
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {curated.map((a, i) => (
                <GridArticleCard key={a.id} a={a} index={i} />
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="feed">
          <h2 id="feed" className="h2-section mb-2">
            {page > 1 ? `All ${category.name} guides — page ${page}` : `All ${category.name} guides`}
          </h2>
          <div className="border-t border-line">
            {feed.items.filter((a) => page > 1 || !curatedIds.has(a.id) || feed.items.length <= 3).map((a) => (
              <ListArticleRow key={a.id} a={a} />
            ))}
            {feed.total === 0 ? <p className="py-10 text-muted">We haven&apos;t published guides in this topic yet. They&apos;re being tested now.</p> : null}
          </div>
          <Pagination page={feed.page} pageCount={feed.pageCount} href={(p) => (p > 1 ? `/category/${slug}?page=${p}` : `/category/${slug}`)} />
        </section>

        {page === 1 && faq.length ? (
          <section aria-labelledby="faq" className="mt-16 max-w-[730px]">
            <h2 id="faq" className="h2-section mb-4">
              Common questions about {category.name}
            </h2>
            <div className="divide-y divide-line border-y border-line">
              {faq.map((f) => (
                <details key={f.question} className="group py-4">
                  <summary className="cursor-pointer list-none font-medium">
                    <span className="mr-2 inline-block font-mono text-muted group-open:rotate-90">›</span>
                    {f.question}
                  </summary>
                  <p className="mt-2 pl-5 text-[15.5px] text-muted">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
