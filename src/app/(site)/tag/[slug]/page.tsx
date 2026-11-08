import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { listPublished } from "@/server/articles/public";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHeader } from "@/components/site/page-header";
import { ListArticleRow } from "@/components/article/article-cards";
import { Pagination, parsePage } from "@/components/site/pagination";

/** Tag pages with fewer than this many guides are noindex (thin) — see SEO policy. */
const MIN_INDEXABLE = 3;

async function load(slug: string, page: number) {
  const tag = await db.tag.findUnique({ where: { slug } });
  if (!tag) return null;
  const feed = await listPublished({ tagId: tag.id, page, perPage: 15 });
  return { tag, feed };
}

export async function generateMetadata({ params, searchParams }: PageProps<"/tag/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = parsePage((await searchParams).page) ?? 1;
  const data = await load(slug, page);
  if (!data) return {};
  const s = await getSettings();
  return buildMetadata({
    title: `Guides tagged “${data.tag.name}” | ${s.brand.name}`,
    description: data.tag.description || `Troubleshooting guides about ${data.tag.name}.`,
    path: page > 1 ? `/tag/${slug}?page=${page}` : `/tag/${slug}`,
    index: data.feed.total >= MIN_INDEXABLE,
    siteName: s.brand.name,
  });
}

export default async function TagPage({ params, searchParams }: PageProps<"/tag/[slug]">) {
  const { slug } = await params;
  const page = parsePage((await searchParams).page);
  if (!page) notFound();
  const data = await load(slug, page);
  // A tag with no published guides is a 404, never an empty 200 page.
  if (!data || data.feed.total === 0 || page > data.feed.pageCount) notFound();
  return (
    <>
      <PageHeader crumbs={[{ name: "All guides", path: "/guides" }, { name: data.tag.name, path: `/tag/${slug}` }]} eyebrow="Topic" title={data.tag.name} lead={data.tag.description ?? undefined} />
      <div className="container-page">
        <div className="border-t border-line">
          {data.feed.items.map((a) => (
            <ListArticleRow key={a.id} a={a} />
          ))}
        </div>
        <Pagination page={data.feed.page} pageCount={data.feed.pageCount} href={(p) => (p > 1 ? `/tag/${slug}?page=${p}` : `/tag/${slug}`)} />
      </div>
    </>
  );
}
