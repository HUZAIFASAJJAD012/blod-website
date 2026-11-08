# SEO implementation

Re-check Google's documentation at release time: [helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article).

## What the code does

| Requirement | Where |
| --- | --- |
| Canonical origin, https, www/non-www, trailing slash (single 308 hop) | `src/proxy.ts` |
| Unique title/description, canonical, OG/Twitter in server HTML | `lib/seo/metadata.ts` + `generateMetadata` per route |
| One H1, semantic H2/H3, anchored headings, TOC | article template + `lib/content/extract.ts` |
| Truthful dates: published, updated (material changes only, with reason), last tested | `articles.firstPublishedAt/materiallyUpdatedAt/lastVerifiedAt` |
| JSON-LD: WebSite, Organization (only when a legal name is set), BreadcrumbList, BlogPosting/Article/NewsArticle, ProfilePage | `lib/seo/jsonld.ts` |
| No FAQPage/HowTo/Review/Product markup | by design; category FAQs are plain content |
| Sitemap: only published, public, indexable, self-canonical URLs + hubs with content | `app/sitemap.ts` |
| robots.txt disallows admin/api/preview/search; staging disallows all | `app/robots.ts` |
| Private surfaces noindex via meta **and** `X-Robots-Tag`, plus auth | admin layout, preview, search, proxy |
| Real 404/410/301/308; no soft 404s; invalid `?page=` → 404 | route handlers + `parsePage` |
| Slug change → automatic 301, chains collapsed, loops rejected | `server/redirects` |
| Thin pages kept out: empty categories noindex, tags < 3 guides noindex, empty tags 404 | category/tag pages |
| CWV: ISR HTML, `next/font` (Plex Sans preloaded), `next/image` with dimensions, reserved ad heights, minimal client JS | throughout |
| On-demand revalidation of every surface on publish/update | `server/articles/revalidate.ts` |

**Sitemap scale:** one file holds up to 50,000 URLs (capped at 45k articles here). Past that, switch `app/sitemap.ts` to `generateSitemaps()` (one file per 40k articles) and submit each file, or a sitemap index route, in Search Console.

## Search Console

1. Add a **Domain property** (DNS TXT record), or a URL-prefix property verified with the meta tag in Admin → Settings → SEO & verification.
2. Submit `https://www.example.com/sitemap.xml` under Sitemaps.
3. Use URL Inspection → "Request indexing" sparingly for important new guides. There is no automated indexing API for ordinary articles, and none is used.
4. Watch Pages (indexing reasons), Core Web Vitals and Manual actions.

## QA tools and their limits

| Tool | Use | Limit |
| --- | --- | --- |
| Rich Results Test | validate Article/Breadcrumb JSON-LD on a live URL | eligibility ≠ display |
| URL Inspection | rendered HTML, canonical Google chose, index status | one URL at a time |
| `site:example.com` | rough discovery check | not an index count |
| Lighthouse / PageSpeed | lab performance, a11y, best practices | lab ≠ field; ranking uses field CWV (p75) |
| CrUX / Search Console CWV | real-user LCP/INP/CLS | needs traffic volume |

Targets: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at p75. Lighthouse goals (≥90 perf, ≥95 a11y/BP/SEO) are internal goals, not ranking requirements.

## Never do

Keyword stuffing, `meta keywords`, spun or unreviewed AI text, fake or refreshed dates, hidden text, doorway pages, PBNs or bought links, scraped or republished content.
