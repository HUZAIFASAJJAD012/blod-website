import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublicAuthor, listPublished } from "@/server/articles/public";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { personLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ListArticleRow } from "@/components/article/article-cards";
import { Pagination, parsePage } from "@/components/site/pagination";

export const revalidate = 3600;

type Social = { label: string; url: string };

export async function generateMetadata({ params }: PageProps<"/authors/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const author = await getPublicAuthor(slug);
  if (!author) return {};
  const s = await getSettings();
  return buildMetadata({
    title: `${author.user.name}${author.roleTitle ? `, ${author.roleTitle}` : ""} | ${s.brand.name}`,
    description: author.bio.slice(0, 200) || `Guides written by ${author.user.name}.`,
    path: `/authors/${slug}`,
    ogType: "profile",
    siteName: s.brand.name,
  });
}

export default async function AuthorPage({ params, searchParams }: PageProps<"/authors/[slug]">) {
  const { slug } = await params;
  const page = parsePage((await searchParams).page);
  if (!page) notFound();
  const author = await getPublicAuthor(slug);
  if (!author) notFound();
  const feed = await listPublished({ authorId: author.userId, page, perPage: 15 });
  const social = (Array.isArray(author.socialLinks) ? author.socialLinks : []) as Social[];

  return (
    <div className="container-page pt-8">
      <Breadcrumbs items={[{ name: "Authors", path: "/about#team" }, { name: author.user.name, path: `/authors/${slug}` }]} />
      <header className="mt-8 grid max-w-[860px] gap-6 sm:grid-cols-[96px_1fr]">
        {author.user.image ? (
          <Image src={author.user.image.fileUrl} alt={author.user.image.alt || author.user.name} width={96} height={96} className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="grid h-24 w-24 place-items-center rounded-full bg-[#ecebe6] text-[34px] font-semibold">
            {author.user.name.slice(0, 1)}
          </span>
        )}
        <div>
          <h1 className="h1-display">{author.user.name}</h1>
          {author.roleTitle ? <p className="mt-2 text-[17px] text-muted">{author.roleTitle}</p> : null}
        </div>
      </header>
      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        <div className="prose-article lg:col-span-7">
          {author.bio.split(/\n{2,}/).map((p) => (
            <p key={p.slice(0, 30)}>{p}</p>
          ))}
          {author.qualificationsText ? (
            <>
              <h2>Experience</h2>
              {author.qualificationsText.split(/\n{2,}/).map((p) => (
                <p key={p.slice(0, 30)}>{p}</p>
              ))}
            </>
          ) : null}
        </div>
        {social.length ? (
          <aside className="lg:col-span-4 lg:col-start-9">
            <h2 className="eyebrow mb-3">Elsewhere</h2>
            <ul className="space-y-2">
              {social.map((l) => (
                <li key={l.url}>
                  <a href={l.url} rel="me noopener noreferrer" className="link-underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
      <section aria-labelledby="by-author" className="mt-14">
        <h2 id="by-author" className="h2-section mb-2">
          Guides by {author.user.name} <span className="text-muted">({feed.total})</span>
        </h2>
        <div className="border-t border-line">
          {feed.items.map((a) => (
            <ListArticleRow key={a.id} a={a} />
          ))}
          {!feed.total ? <p className="py-8 text-muted">No published guides yet.</p> : null}
        </div>
        <Pagination page={feed.page} pageCount={feed.pageCount} href={(p) => (p > 1 ? `/authors/${slug}?page=${p}` : `/authors/${slug}`)} />
      </section>
      <JsonLd data={personLd({ name: author.user.name, path: `/authors/${slug}`, jobTitle: author.roleTitle || undefined, description: author.bio.slice(0, 300) || undefined, sameAs: social.map((s) => s.url) })} />
    </div>
  );
}
