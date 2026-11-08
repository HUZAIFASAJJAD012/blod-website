import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { searchPublished } from "@/server/articles/public";
import { NOINDEX } from "@/lib/seo/metadata";
import { formatDate } from "@/lib/utils/format";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { Pagination, parsePage } from "@/components/site/pagination";
import { requestIpHash } from "@/lib/utils/request";
import { rateLimit } from "@/server/security/rate-limit";
import { SearchTracker } from "@/components/site/search-tracker";

// Internal search results are never indexed (thin, infinite URL space).
export const metadata: Metadata = { title: "Search | FixLayer", robots: NOINDEX };

/** ts_headline markers → <mark>; everything else rendered as text (React escapes it). */
function Highlight({ text }: { text: string }) {
  const parts = text.split(/(\[\[\[.*?\]\]\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[[[") ? (
          <mark key={i} className="rounded-sm bg-[#fdf1c7] px-0.5 text-ink">
            {p.slice(3, -3)}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = parsePage(sp.page) ?? 1;
  const ip = await requestIpHash();
  const rl = q ? await rateLimit(`search:${ip}`, 60, 60) : { ok: true };
  const results = q && rl.ok ? await searchPublished(q, page, 10) : { hits: [], total: 0, query: q.trim() };
  const pageCount = Math.max(1, Math.ceil(results.total / 10));

  return (
    <div className="container-page pt-8">
      <Breadcrumbs items={[{ name: "Search", path: "/search" }]} />
      <h1 className="h1-display mt-8">Search guides</h1>
      <form action="/search" method="get" role="search" className="mt-6 flex max-w-2xl flex-col gap-3 sm:flex-row">
        <label htmlFor="search-q" className="sr-only">
          Search query
        </label>
        <input id="search-q" name="q" type="search" defaultValue={q} maxLength={120} className="input" placeholder="Error message, product or symptom" autoFocus={!q} />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      <div className="mt-10 max-w-[860px]" aria-live="polite">
        {!rl.ok ? <p className="field-error">Too many searches in a short time. Please wait a minute and try again.</p> : null}
        {q && rl.ok ? (
          <p className="mono-label mb-4 text-muted">
            {results.total} {results.total === 1 ? "result" : "results"} for “{results.query}”
          </p>
        ) : null}
        {q && rl.ok && results.query.length < 2 ? <p className="text-muted">Type at least two characters.</p> : null}
        <ol className="divide-y divide-line border-y border-line">
          {results.hits.map((h) => (
            <li key={h.id} className="py-5">
              <Link href={`/category/${h.categorySlug}`} className="eyebrow text-accent no-underline">
                {h.categoryName}
              </Link>
              <h2 className="mt-1 text-[19px] font-semibold">
                <Link href={`/guides/${h.slug}`} className="title-link">
                  {h.title}
                </Link>
              </h2>
              <p className="mt-1.5 text-[15px] text-muted">
                <Highlight text={h.headline || h.excerpt} />
              </p>
              <p className="mono-label mt-1.5 text-muted">{formatDate(h.firstPublishedAt)}</p>
            </li>
          ))}
        </ol>
        {q && rl.ok && results.query.length >= 2 && results.total === 0 ? (
          <div className="py-8">
            <p className="text-[17px] font-medium">No guides match that yet.</p>
            <p className="mt-2 text-muted">
              Try fewer words or the exact error code. Or{" "}
              <Link href={`/contact?topic=question`} className="link-underline">
                tell us what you&apos;re stuck on
              </Link>{" "}
              — reader questions decide what we test next.
            </p>
          </div>
        ) : null}
        <Pagination page={page} pageCount={pageCount} href={(p) => `/search?q=${encodeURIComponent(q)}${p > 1 ? `&page=${p}` : ""}`} />
      </div>
      {q ? <SearchTracker resultCount={results.total} /> : null}
    </div>
  );
}
