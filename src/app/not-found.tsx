import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getCategoriesWithCounts } from "@/server/articles/public";
import { NotFoundBeacon } from "@/components/site/not-found-beacon";
import { NOINDEX } from "@/lib/seo/metadata";

export const metadata: Metadata = { title: "Page not found | FixLayer", robots: NOINDEX };

/** Real 404 (status set by Next.js) with useful navigation; also logs the miss for the SEO dashboard. */
export default async function NotFound() {
  const categories = (await getCategoriesWithCounts()).filter((c) => !c.parentId && c.count > 0);

  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page py-16 lg:py-24">
        <p className="eyebrow">Error 404</p>
        <h1 className="h1-display mt-3 max-w-[20ch]">We couldn&apos;t find that page</h1>
        <p className="mt-4 max-w-[60ch] text-[17px] text-muted">The link may be old or mistyped. If you followed a link from another site, the guide may have moved — searching usually finds it.</p>
        <form action="/search" method="get" role="search" className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
          <label htmlFor="nf-q" className="sr-only">
            Search guides
          </label>
          <input id="nf-q" name="q" type="search" className="input" maxLength={120} placeholder="Search guides" />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
        <div className="mt-12 grid gap-10 md:grid-cols-2">
          {categories.length ? (
            <section>
              <h2 className="eyebrow mb-3">Browse topics</h2>
              <ul className="space-y-2">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link href={`/category/${c.slug}`} className="link-underline">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section>
            <h2 className="eyebrow mb-3">Or go to</h2>
            <ul className="space-y-2">
              <li><Link href="/" className="link-underline">Homepage</Link></li>
              <li><Link href="/guides" className="link-underline">All guides</Link></li>
              <li><Link href="/tools" className="link-underline">Tools &amp; checklists</Link></li>
              <li><Link href="/contact" className="link-underline">Contact us</Link></li>
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
      <NotFoundBeacon />
    </>
  );
}
