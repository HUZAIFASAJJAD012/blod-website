import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listPublished } from "@/server/articles/public";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHeader } from "@/components/site/page-header";
import { ListArticleRow } from "@/components/article/article-cards";
import { Pagination, parsePage } from "@/components/site/pagination";

export async function generateMetadata({ searchParams }: PageProps<"/guides">): Promise<Metadata> {
  const page = parsePage((await searchParams).page) ?? 1;
  const s = await getSettings();
  return buildMetadata({
    title: page > 1 ? `All troubleshooting guides — page ${page} | ${s.brand.name}` : `All troubleshooting guides | ${s.brand.name}`,
    description: "Every published FixLayer guide, newest first: tested fixes for WordPress, WooCommerce, hosting, Cloudflare, DNS, email, payments and Node.js.",
    path: page > 1 ? `/guides?page=${page}` : "/guides",
    siteName: s.brand.name,
  });
}

export default async function GuidesPage({ searchParams }: PageProps<"/guides">) {
  const page = parsePage((await searchParams).page);
  if (!page) notFound();
  const data = await listPublished({ page, perPage: 15 });
  if (page > data.pageCount) notFound();

  return (
    <>
      <PageHeader
        crumbs={[{ name: "All guides", path: "/guides" }]}
        eyebrow={`${data.total} published ${data.total === 1 ? "guide" : "guides"}`}
        title="All troubleshooting guides"
        lead="Newest first. Every guide lists the author, publication date and — where it was tested — the exact environment."
      />
      <div className="container-page">
        <div className="border-t border-line">
          {data.items.length ? data.items.map((a) => <ListArticleRow key={a.id} a={a} />) : <p className="py-10 text-muted">No guides have been published yet.</p>}
        </div>
        <Pagination page={data.page} pageCount={data.pageCount} href={(p) => (p > 1 ? `/guides?page=${p}` : "/guides")} />
      </div>
    </>
  );
}
