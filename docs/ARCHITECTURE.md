# Architecture

## One app, three layers

```
src/
  app/            routes only. (site) = public, (admin)/admin = CMS, api/ = HTTP integrations
  components/     site/ article/ editor/ admin/ ads/ seo/ tools/
  lib/            framework-free logic: auth, permissions, content model, seo, schemas, utils
  server/         server-only services: articles, media, users, leads, redirects, settings, security, email
  proxy.ts        canonical host, managed redirects, security headers, admin gate (Node runtime)
prisma/           schema, reviewed SQL migrations, seed
tests/            unit, integration (real Postgres), e2e, seo, accessibility
```

Rules: pages and components call `server/*` services. Services enforce permissions themselves (`lib/permissions`), so every entry point is guarded, whether it's a server action, route handler or cron. Hiding a button is never authorization.

## Data model (Prisma → PostgreSQL)

| Table | Purpose / notes |
| --- | --- |
| `users`, `sessions`, `password_reset_tokens`, `invitations` | Identity. Sessions store a SHA-256 of the cookie token; reset/invite tokens are hashed, single-use, expiring. Optional TOTP seed is AES-GCM encrypted. |
| `author_profiles` | Public bio, role title, experience, links. Private until the person writes a real bio. |
| `articles` | Content + workflow + evidence + SEO fields. `bodyJson` (TipTap JSON, sanitized) is the source of truth; `bodyText` is derived for search/checks; `searchVector` is a **generated** weighted `tsvector` with a GIN index. `version` provides optimistic concurrency. |
| `article_revisions` | Full editable snapshot per save (autosaves at most one per 10 min). |
| `categories`, `tags`, `article_tags`, `article_categories` | One primary category (required) + up to 3 secondary. |
| `references`, `related_articles` | Citations with access date and link-health status; curated related guides (max 5, published only). |
| `media` | Provider key, dimensions, MIME (sniffed), alt, caption, credit, licence, focal point. |
| `preview_tokens` | Hashed, expiring preview links. |
| `redirects`, `not_found_events` | Managed 301/308 with hit counts; 404 log for the SEO dashboard. |
| `content_checks` | Latest advisory check results per article. |
| `ad_placements`, `site_settings` | Monetization slots (disabled by default); typed, Zod-validated settings JSON (no secrets). |
| `contact_submissions`, `newsletter_subscriptions`, `email_outbox` | Leads with consent; double opt-in; transactional email outbox with retries. |
| `audit_logs`, `rate_limit_buckets`, `job_runs`, `article_views_daily` | Audit trail (IP as keyed hash), serverless-safe rate limiting, cron runs, optional aggregate view counts. |

Key indexes: `(status, firstPublishedAt DESC)`, `(primaryCategoryId, status, firstPublishedAt DESC)`, `(authorId, status)`, `(status, scheduledAt)`, `(status, updatedAt DESC)`, GIN on `searchVector`, unique slugs on articles/categories/tags/authors, unique `fromPath` on redirects.

**Migration note:** Prisma can't model the GIN index on the generated column. Create new migrations with `prisma migrate dev --create-only`, then delete any generated `DROP INDEX "articles_searchVector_idx"` / `ALTER COLUMN "searchVector"` lines before applying.

## Route map

Public (`(site)`):

| Route | Rendering | Indexable |
| --- | --- | --- |
| `/` | ISR 1h + on-demand | yes |
| `/guides`, `/guides?page=n` | dynamic | yes (self-canonical per page; page 1 in sitemap) |
| `/guides/[slug]` | ISR 1h + on-demand on publish/update | per article `robotsIndex` |
| `/category/[slug]` | dynamic | only when it has ≥1 published guide |
| `/tag/[slug]` | dynamic | only with ≥3 guides; 404 when empty |
| `/authors/[slug]` | ISR | yes (public profiles only) |
| `/search` | dynamic | **noindex** |
| `/tools`, `/tools/[slug]` | static | yes |
| `/about`, `/contact`, policies | static/ISR | yes (`/cookie-preferences` noindex) |
| `/preview/[token]` | dynamic | **noindex** + `X-Robots-Tag` |
| `/newsletter/confirm`, `/newsletter/unsubscribe` | dynamic | noindex; changes happen via POST only, so mail scanners can't trigger them |

CMS (`/admin`, always dynamic, `X-Robots-Tag: noindex`, nonce CSP): dashboard, articles (list/new/edit/revisions), media, categories & tags, inbox, SEO issues, redirects, authors & users, profile, monetization, settings, audit log; plus login/MFA/forgot/reset/accept-invite.

API: `POST /api/uploads` (multipart or presign/complete), `POST /api/preview`, `POST /api/contact`, `POST /api/newsletter`, `GET|POST /api/cron` (Bearer secret), `GET /api/health`. Also `/sitemap.xml`, `/robots.txt`, `/ads.txt`, `/manifest.webmanifest`, `/opengraph-image`, `/icon`, `/uploads/*` (local driver).

## Caching decision: Cache Components off

Next 16 scaffolds new apps with Cache Components (PPR) on. We turned it off on purpose. PPR streams pages after the shell is sent, which can deliver `notFound()` and `permanentRedirect()` with a 200 status (soft 404s). For a search-first publication, correct status codes matter more. Instead:

- Public pages use ISR (`revalidate = 3600`).
- `revalidateArticleSurfaces()` invalidates the article, old slugs, home, guides, categories, tags, author page, articles that link to it as related, and the sitemap on publish, unpublish, update, archive, slug change and scheduled publication.
- Settings are cached with `unstable_cache` + tag `settings`.

## Editorial workflow

`DRAFT → IN_REVIEW → APPROVED → PUBLISHED | SCHEDULED → (cron) PUBLISHED`; `requestChanges`, `unpublish`, `archive`, `restoreDraft`. Rules live in `server/articles/workflow.ts` (pure, unit-tested). Transitions use a conditional `UPDATE … WHERE status = <expected>`, so concurrent transitions can't both succeed. Scheduled publishing claims each row the same way, so overlapping cron runs publish exactly once (covered by an integration test and an E2E test).

## Rich text

TipTap JSON → `sanitizeDoc()` (allowlist of node types, marks and attributes; protocol checks; depth/size limits) on save **and** before render. The server renderer (`components/article/rich-content.tsx`) maps nodes to React elements and never injects HTML; code highlighting comes from lowlight's hast tree, keeping only `hljs-*` spans.
