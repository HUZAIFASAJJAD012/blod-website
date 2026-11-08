# MASTER BUILD PROMPT — NEXT.JS SEO-FIRST TECHNICAL PUBLICATION & ADSENSE-READY CMS

**Research baseline:** 7 November 2026. **Purpose:** Paste this prompt into Cursor, Claude Code, or another coding agent. Implement a real application, not a static mockup. Google Search ranking and AdSense approval are not guaranteed. Policies change: re-check primary sources at release.

## 0. Role, deliverable and non-negotiable outcome

Act as a principal Next.js architect, senior product designer, technical SEO specialist, Google AdSense integration specialist, database architect, security engineer, and QA lead. Build a production-ready, credible technology troubleshooting publication focused on WordPress fixes, WooCommerce issues, web hosting, Cloudflare, Next.js/Node.js deployment, DNS/SSL, SMTP email, and payment integrations. The purpose is to publish first-hand, tested troubleshooting guides, attract qualified organic search traffic, generate legitimate affiliate referrals and service enquiries, and become eligible for a separate Google AdSense review.

**Build both frontend and backend in the SAME Next.js App Router codebase.** No separate NestJS service unless explicitly approved. Use a scalable project structure, fully functional admin CMS, a server-rendered public website, migrations, test coverage, and deployment documentation. Every public call-to-action must work. No fake counters, fabricated testimonials, invented author credentials, fake article dates, placeholder copy on production, broken navigations, scraped articles, or fake AdSense approval badges. Never promise rankings or approval.

Implement vertically, beginning with a working MVP and then expanding. Do not stop at beautiful static screens. Deliver schema, migrations, working authenticated CRUD, media upload, publishing, SEO metadata, sitemap, robots, ads.txt, analytics and AdSense-ready integration, structured data, security, performance tests, and deployment.

## 1. Brand, audience, niche positioning

Working brand: **FixLayer** — a placeholder only; confirm trademark and domain availability before production. Header tagline: **Practical fixes for websites, hosting and modern web apps.**

English-language audience: website owners, WordPress/WooCommerce operators, freelancers, agency developers, and technical small-business owners, initially targeting US/UK and international English-speaking search traffic. Voice: precise, calm, human, practical, evidence-based, never hype-driven. Primary page intent: fix a real problem; secondary intents: compare hosting/services, refer reputable software, or hire help for difficult incidents.

Initial editorial silos: WordPress, WooCommerce, Hosting & Servers, Cloudflare & DNS, Next.js & Node.js, Payments & Webhooks, Email & Deliverability, Tools & Checklists. Do NOT add unrelated categories just for traffic. Allow category configuration in CMS.

## 2. Stack and architecture

- Next.js **16.x App Router**, or the latest supported stable major at implementation time after checking migration and security notes; React, TypeScript strict mode.
- Tailwind CSS and CSS variables, shadcn/ui or accessible Radix primitives only for admin/forms; create a distinctive custom public editorial design. Do not use a template-looking shadcn landing page.
- PostgreSQL; Prisma ORM with reviewed migrations and indexes. One app with `src/app`, `src/components`, `src/lib`, `src/server`, `prisma`, `tests`.
- Auth.js or equivalent secure server-managed session/auth design; RBAC: OWNER, ADMIN, EDITOR, AUTHOR. Protect admin in server code, not just client routing. Use secure, HttpOnly, SameSite cookies, rate-limited login, CSRF protection for cookie-authenticated writes, password hashing if passwords are stored, recovery and optional MFA.
- TipTap/ProseMirror structured rich-text editor with robust sanitization and server-side HTML rendering; code blocks with syntax highlighting, accessible tables, images, callouts, notes, warnings, steps, lists, anchored headings. Do not use unchecked HTML injection.
- S3-compatible object storage or Cloudinary for media; signed uploads, MIME/size validation, optimized responsive image variants, descriptive alt text, attribution/license metadata, deletion/orphan cleanup.
- Zod validation of all write payloads; server actions for trusted form flows and route handlers for HTTP integrations. Keep secrets server-only. Add logging and error tracking without exposing customer data.
- Vercel or Railway-compatible hosting, managed Postgres, staging/prod environments, automated migrations, reliable backups, health checks. Document queue/cron choices; do not rely on always-running in-memory timers in serverless environments.
- Prefer React Server Components and server fetching for indexable content; client JavaScript only for necessary interactive features.

### Directory structure

```
src/
  app/
    (site)/
      page.tsx
      guides/page.tsx
      guides/[slug]/page.tsx
      category/[slug]/page.tsx
      tag/[slug]/page.tsx
      authors/[slug]/page.tsx
      search/page.tsx
      about/page.tsx
      contact/page.tsx
      editorial-policy/page.tsx
      corrections-policy/page.tsx
      privacy-policy/page.tsx
      terms/page.tsx
      affiliate-disclosure/page.tsx
    (admin)/
      admin/page.tsx
      admin/login/page.tsx
      admin/articles/page.tsx
      admin/articles/new/page.tsx
      admin/articles/[id]/edit/page.tsx
      admin/media/page.tsx
      admin/categories/page.tsx
      admin/authors/page.tsx
      admin/seo/page.tsx
      admin/redirects/page.tsx
      admin/monetization/page.tsx
      admin/settings/page.tsx
      admin/audit-log/page.tsx
    api/
      contact/route.ts
      uploads/route.ts
      preview/route.ts
      newsletter/route.ts
      health/route.ts
    sitemap.ts
    robots.ts
    manifest.ts
    opengraph-image.tsx
    layout.tsx
    not-found.tsx
  components/{site,article,editor,admin,ads,seo,ui}/
  lib/{seo,schemas,auth,db,permissions,content,ads,utils}/
  server/{articles,media,users,analytics,redirects,settings}/
prisma/{schema.prisma,migrations,seed.ts}
tests/{unit,integration,e2e,accessibility,seo}/
public/{favicon.ico,brand-assets}
```

Routes may be refined but preserve semantics, crawlability, and published URLs. Configure `SITE_URL` and use HTTPS canonical origin. Handle www/non-www with consistent permanent redirects.

## 3. Public visual design — polished, human-designed, editorial, not generic AI

Create a calm premium technology journal: serious publication hierarchy, editorial typography, controlled asymmetry, authentic product screenshots/code samples, sensible density, grid alignment, strong readability. Avoid the typical AI startup aesthetic: no glowing gradients, purple-blue glass cards, randomly floating icons, fake 3D mascots, stock people photos, meaningless decorative blobs, oversized empty hero, identical white rounded cards throughout, or emoji UI.

**Design tokens**
- Canvas: `#F7F6F2` warm off-white, article surface `#FFFFFF`, main text `#17191E`, muted text `#606875`, border `#DDDDE1`, accent deep cobalt `#2254C5`, hover `#193F94`, code panel `#111820`, code text `#ECF0F4`, positive `#247052`, warning `#A86B21`.
- Font: `IBM Plex Sans` for body and headings, `IBM Plex Mono` for technical labels/code (load with `next/font`; subset and preload appropriately). Body 16px/1.7 on desktop; article 17px/1.78; desktop H1 48px/1.12 with letter spacing -1.4px, H2 31px/1.24, H3 23px/1.35; mobile H1 34px/1.14, article body 16px/1.75.
- Container desktop max 1240px with 32px side gutters; article copy max 730px; desktop TOC 250px; sidebar gap 54px. Grid 12 columns, consistent 8px spacing scale: 4, 8, 12, 16, 24, 32, 40, 48, 64, 80.
- Desktop header height 76px; border-bottom 1px; logo left, categories center, search and newsletter on right. Sticky only after scroll, unobtrusive. Mobile header 64px; accessible drawer and search.
- Buttons min-height 44px; corner radius 6–10px; cards 8–12px. Restrained motion 150–220ms ease-out, respect reduced-motion. No page transition that delays reading.
- Icons: Lucide, restrained and meaningful. Use purposeful technical screenshot imagery, original diagrams, code interfaces, no generic stock photos.
- Accessibility: WCAG 2.2 AA aim, keyboard navigation, visible focus, real heading hierarchy, labeled inputs, sufficient contrast, semantic landmarks, skip link and alt text.

**Responsive targets**: 1440px desktop, 1024px small desktop, 768px tablet, 390px mobile and 320px narrow mobile. Test on actual width screenshots. No sideways page scrolling except explicitly scrollable code blocks/tables.

### Homepage precise layout (1440 viewport)
1. 76px header; max-width 1240px.
2. Compact hero content region ~360–420px tall, 48px top spacing, 12-col grid: left 7 cols includes eyebrow `INDEPENDENT WEB TROUBLESHOOTING`, H1 `Fix the problem. Understand the cause.`, 2-line value proposition, horizontal search form and popular topic chips. Right 5 cols displays a designed, REAL diagnostic illustration built from composited CSS/code output (no fake app screenshots), listing sample error states and documented fix pathways.
3. Thin trusted-navigation band with topic links (not invented logos or testimonials).
4. `Start here` editorial topic index: 4 to 6 categories with count of actual published articles (no fake count), small textual descriptions, icon accents.
5. `Recently updated fixes`: editorial 2-column layout with a large featured real guide and a 2×2 grid of supporting guides; cards have category, title, human-created excerpt, author, actual publication/update dates; avoid card clones.
6. `Most useful guides`: 3-column restrained article grid with content-driven section hierarchy.
7. `Developer notes`: dark (#111820) horizontal strip with original terminal commands/tutorials, high contrast.
8. `Free tools & checklists`: only tools that really work (e.g. HTTP status explainer, DNS checklist, SSL checklist), no fake calculators.
9. Newsletter form with double opt-in and privacy text; never claim subscriber numbers without data.
10. Substantial footer with categories, about/editorial/corrections/policy, legal, contact, accessible navigation.

### Article page precise layout
- Header and breadcrumbs. Category + actual date + author. H1 (48 desktop/34 mobile), descriptive summary, `Last tested` optionally if testing evidence exists; featured screenshot only when meaningful.
- Desktop content column 730px plus 250px sticky TOC. TOC generated from real H2/H3 headings, collapsible on mobile.
- `Quick fix` summary anchored near top after brief introduction, but only if accurate and helpful.
- Step blocks with clear numbering, code blocks with working Copy button, warnings, expected outputs, error alternatives, diagnostics, screenshots, image lightbox, image credit.
- A clearly labeled `Tested environment` block showing actual version/system conditions; optional version compatibility badges only when verified.
- Source/reference links and `Related troubleshooting` with contextual links, not keyword-stuffed lists.
- Author bio, review/corrections notice, related posts and natural CTA `Need help fixing this?` leading to contact. Affiliate link disclosure near relevant recommendations.
- Ad positions reserved with stable dimensions so content does not jump; no ads inside code copy controls or next to primary buttons.

### Category, search and utility pages
- Category: unique editorial introduction + curated best articles + paginated article feed + useful FAQ-as-content (do not rely on FAQ rich results).
- Search: functional full-text search using indexed PostgreSQL full-text initially; noindex internal search-results pages, handle query escaping and limits.
- Author pages: actual bios, experience, links and articles; no fabricated individuals/credentials.
- Information pages: About, Contact (working), Editorial Policy, Corrections Policy, Privacy Policy, Terms, Affiliate Disclosure, optionally Cookie Preferences.
- 404: useful, real searchable navigation. Do not route missing pages to HTTP 200.

## 4. Full admin CMS — exact article creation/edit form

Route `/admin/articles/new`; 1440 desktop: 72px admin top bar; left sidebar 248px; main editor area flex 1 max 900px; right settings panel 320px, sticky; bottom sticky action toolbar. Mobile: sidebar drawer, settings become accordion/tabs. All fields save drafts, show explicit validation and autosave state; warn on unsaved changes.

**A. Basic details (main column)**
1. Article title: required, text, human readable; show live character count without hard Google word-length penalty.
2. Slug: required; auto-suggest from title, editable, lower-case kebab-case, unique and validated, warn about modifying a published URL and offer automatic 301 redirect.
3. Short excerpt / deck: required, 1–3 sentences; separate from SEO description.
4. Category: required single primary category; optional secondary categories only if editorially justified.
5. Topic/tags: searchable multi-select with duplication guard; avoid auto-generating hundreds of thin tag pages.
6. Cover/feature image: upload, crop/focal point, descriptive alt, title/caption/credit/license, width/height; support social share image separately.
7. Main body editor: heading H2/H3, paragraph, lists, tables, blockquotes, inline links, citations, source footnotes, callouts, responsive images, code fences (language picker, copy action), numbered steps, embeds with consent/performance controls, reusable caution boxes. Sanitize on save and render.
8. In-article jump links / TOC: generate automatically and preview.
9. Related articles: curated search-select, maximum 5; suggest with human approval; link to published existing content only.
10. Article type: Troubleshooting, Tutorial, Comparison, Checklist, Opinion, News (news requires freshness and sourcing).

**B. Evidence & editorial integrity (right panel)**
11. Real author: selected from real users with published bio; no invented credentials.
12. Reviewer (optional); reviewed-at timestamp only after review completed.
13. Tested software/version / hosting environment (optional but strongly suggested for tutorials).
14. Steps verified checklist / original screenshots present / factual claims sourced.
15. External references as URLs with title, access date, primary source flag; link-health check.
16. Last verified date; updated date only if material content changes, not a ranking trick.
17. Corrections note and revision reason when updating.
18. Affiliate disclosures: flag and editable disclosure snippet; link rel sponsored where applicable.

**C. SEO panel with live preview**
19. SEO title: customizable with preview; recommend concise descriptive text, no arbitrary forced 60-character rejection.
20. Meta description: editable summary with live approximate snippet; no claim that exact character count guarantees display.
21. Primary search intent/keyword: internal editorial planning metadata, NOT output as `meta keywords`.
22. Secondary queries/questions: internal only; don't force keyword density.
23. Canonical URL: computed by default; override needs warning/admin permission; validate same-source cases.
24. Robots policy: index/follow by default only for published, substantive content; noindex controls for exceptional content; hard-block indexing of drafts, previews, admin, search, private views.
25. Social metadata: OG title, OG description, OG image, Twitter card preview.
26. Schema type: default BlogPosting/Article; only allow supported truthful types matching actual page content; JSON-LD preview and validation.
27. Link inspector: counts actual internal and external links, identifies broken links, rel flags, redirects, and links to drafts.
28. Content checks as advisory (not fake Google ranking score): missing alt text, repeated title, empty title, poor heading structure, unverified claims, identical/meta duplicate, missing author, missing citations, thin content, canonical mismatch, unavailable images, too many ads, broken links.
29. SERP mock preview: illustrative only; show Google can rewrite titles/descriptions.

**D. Publishing controls**
30. Status: DRAFT, IN_REVIEW, APPROVED, SCHEDULED, PUBLISHED, ARCHIVED.
31. Schedule publish date + timezone; execute reliably via cron/queue and verify intended publication occurs once.
32. Visibility: public, private preview; tokenized expiring editorial preview, never indexed.
33. Save draft, submit review, approve, publish now, schedule, unpublish, duplicate as draft, archive, view live, preview.
34. Sticky top confirmation of autosaved timestamp; optimistic UI only after server confirmation and appropriate errors/retries.
35. Revisions: searchable diff history, restore previous revision with an audit log and explicit confirmation.
36. Permission enforcement: authors can edit own drafts; editors approve; admins configure site, ads, users; owners manage all.

**E. Featured controls**
37. Homepage feature toggles, order, category collection membership; only published records may be featured.
38. Pin until date / editorial priority (optional) never overrides relevance mechanically.
39. Article media file meta and image attribution.
40. Optional content briefs (internal only): query intent, competitor observations, unmet reader needs, original experiment to run, reader difficulty.

**Additional CMS modules**
- Dashboard: real published/draft/scheduled counts, recent changes, 404 events, publishing queue, contact inquiries, configured analytics only if authenticated API connected, no fabricated chart data.
- Article table: search, filter by status/author/date/category, sort, pagination, bulk archive (safe), bulk noindex with confirmation.
- Categories: slug, summary, featured asset, SEO metadata, parent relation if needed; prevent empty thin category pages from indexation.
- Media: asset browsing, attribution and cleanup.
- Authors/users: onboarding, invitations, access revoke, profile, optional MFA.
- Redirect manager: `from_path`, `to_url`, `status=301|308`, reason, redirect hit count; detect loops and chains.
- SEO issues dashboard: duplicate canonicals, broken internal links, articles excluded from sitemap, missing image alts, unpublished referenced links, 404s, stale guides, oversized payloads.
- Ad management: actual publisher ID configured server-side, ads.txt entry, ad units/placements, placement enable toggle, preview placeholders, consent integration status; manual `approved` field is editorial flag and must never claim to reflect Google verification.
- Settings: brand, menus, footer, legal text, social links, default metadata, analytics measurement ID, webmasters verification tokens, sitemap toggles, email, newsletter, backups.
- Audit trail: user, action, entity, timestamp, before/after summary, IP hashed/redacted as appropriate.

## 5. PostgreSQL / Prisma schema (implementation-grade data model)

Use named tables or models with explicit relations, foreign keys, indexes, timestamps and enum definitions:

1. `User(id, name, email UNIQUE, passwordHash?, role, status, imageId?, createdAt, updatedAt, lastLoginAt)`.
2. `AuthorProfile(userId UNIQUE, slug UNIQUE, bio, roleTitle, qualificationsText, socialLinks JSON, isPublic)`.
3. `Article(id, title, slug UNIQUE, excerpt, bodyJson JSONB, bodyHtmlSanitized?, primaryCategoryId, authorId, reviewerId?, status ENUM, type ENUM, coverMediaId?, metaTitle?, metaDescription?, canonicalOverride?, robotsIndex, ogTitle?, ogDescription?, ogImageId?, firstPublishedAt?, scheduledAt?, updatedAt, materiallyUpdatedAt?, lastVerifiedAt?, createdAt, archivedAt?, readingMinutes?, featuredRank?, affiliateDisclosureFlag)`.
4. `ArticleRevision(id, articleId, authorId, version, snapshotJson, summary, createdAt)`.
5. `Category(id, name, slug UNIQUE, description, seoTitle?, seoDescription?, parentId?, visible)`.
6. `Tag(id, name, slug UNIQUE, description?)`, `ArticleTag(articleId, tagId)`.
7. `ArticleCategory(articleId, categoryId)` if multiple category affiliation is enabled; retain one primary category.
8. `Media(id, providerKey UNIQUE, fileUrl, width, height, mime, size, alt, caption, copyrightHolder?, license?, focalX?, focalY?, uploadedById, createdAt)`.
9. `Reference(id, articleId, title, url, publisher?, accessedAt, referenceType)`.
10. `RelatedArticle(articleId, relatedId, sortOrder)`.
11. `Redirect(id, fromPath UNIQUE, toPathOrUrl, httpStatus, reason, enabled, createdAt)`.
12. `AdPlacement(id, key UNIQUE, label, adUnitId?, enabled, positions JSON, minContentThreshold?, createdAt)`.
13. `SiteSetting(key UNIQUE, valueJson, updatedAt, updatedById)` — never store unencrypted sensitive secrets here; use environment/secret manager.
14. `ContactSubmission(id, name, email, subject, message, consent, status, createdAt)` with retention/deletion policy and spam protection.
15. `NewsletterSubscription(id, email UNIQUE, consentAt, confirmedAt?, status, source?)` — double opt-in, easy unsubscribe.
16. `AuditLog(id, actorId, action, entityType, entityId, summaryJson, createdAt)`.
17. `ContentCheck(id, articleId, checkType, severity, resultJson, checkedAt)`.
18. `ArticleViewDaily(articleId, day, views)` only for consent-compliant first-party analytics if enabled, with privacy guardrails; prefer GA4 aggregates and avoid individual visitor tracking where unnecessary.

Indexes: published article by `(status, firstPublishedAt DESC)`, `(primaryCategoryId, status, firstPublishedAt DESC)`, author/status, scheduledAt/status, category slug, full-text search document and editorial updated-at. Enforce relational integrity and slug uniqueness in DB. Do not expose unpublished records through public queries, SEO or API.

## 6. Server-side actions and API endpoints

Implement strictly validated and authorized backend service functions or route handlers for:
- auth login/logout/session, invite/role grants, forgot-password or passwordless flow;
- article CRUD, autosave, revision restore, preview token, submit/approve/publish/schedule/unpublish/archive;
- category/tag/media CRUD, signed upload and image transforms, related-article selection;
- site search, search suggestions with throttling, published feeds/category pagination;
- SEO diagnostics, metadata preview, redirect management, sitemap generation;
- contact email enqueue with spam checks and user consent, safe newsletter double opt-in;
- public site settings, monitored errors, policy pages, consent settings/ad placement;
- protected analytics sync only after explicit integration is configured.

Use typed Zod DTOs; consistent JSON error envelopes; pagination limits; abuse/rate limiting; request ID logs. Render public pages from DB in Server Components with caching/revalidation strategy; revalidate article, category, homepage and sitemap when publishing. Handle scheduled posts using hosting platform cron with idempotent DB transaction.

## 7. Google Search SEO — must implement, not merely describe

- Canonical domain and permanent www/HTTPS redirect strategy; friendly `/{category}` and `/guides/{slug}` paths if consistent.
- Every published page: unique descriptive `<title>`, correct meta description, one main H1, semantic H2/H3, article author and truthful timestamps, canonical link, OG/Twitter metadata, image alt attributes, readable URL slug, breadcrumbs.
- Use Next.js `metadata` or `generateMetadata` on Server Components; no client-only helmet SEO. Ensure metadata present in rendered HTML.
- `app/sitemap.ts` includes ONLY canonical, published, indexable URLs and important content hubs; exclude draft, preview, admin, internal search, redirect destinations with duplicate aliases, paginated filtered junk. `lastModified` must reflect a real significant change; handle tens of thousands via sitemap splitting when needed.
- `app/robots.ts` allow public site, disallow admin/private/search as appropriate, include sitemap URL, but **do not rely on robots.txt alone to deindex a page**: apply `noindex` where needed and require authentication for private content.
- Create `public/ads.txt` from actual AdSense publisher ID when assigned; never use a fictitious publisher ID in production. Ensure root path accessible, including redirects.
- Correct 200/301/308/404/410 statuses; never soft 404; redirect old slugs one hop with loop validation.
- JSON-LD: `WebSite`, `Organization` when truthful, `BreadcrumbList`, and `BlogPosting` or `Article` for content pages with real author, headline, image, datePublished/dateModified, publisher. Schema must match visible content. Do not misuse FAQ/Review/Product rich-result markup.
- Distinct navigation for pillar pages, subtopic articles, related guides; use meaningful anchor text; link only to published content.
- Optimize real user experience and Core Web Vitals: targets LCP <=2.5s, INP <=200ms, CLS <=0.1 at p75; avoid render-blocking scripts, lazy-load below fold media, reserve image and ad dimensions, use optimized images and fonts.
- Integrate Google Search Console verification token and GA4 if supplied; don't fabricate keywords or metrics. Include step-by-step setup instructions and how to submit sitemap.
- Allow requesting search crawls manually through Search Console; never promise indexing or force automated indexing for ordinary articles.
- No keyword stuffing, meta keywords, spun content, mass unreviewed AI output, fake dates, hidden text, doorway pages, PBNs, purchased spam links, or scraping/republication.
- Structured data test, Rich Results Test, `site:` discovery check, URL inspection, and Lighthouse/PageSpeed as QA checks; document their limits.

## 8. Google AdSense compliance & integration — policy-oriented

Build an AdSense-ready website, not an "approval guarantee". Actual site approval is determined by Google after publisher application/review. Requirements include own original useful content, discoverable navigation, enough substantive public pages for evaluation, accessible legal information, policy compliance and site ownership/HTML control. **There is no Google-published universal 20-post, 30-post, or traffic threshold for approval.**

- Ads disabled by default until site owner enters a real `ca-pub-...` ID, adds the site to AdSense, receives approval, and enables placements. Site admins must not be able to spoof Google's approval status as a live verified API response.
- Global AdSense loader `next/script` with `afterInteractive`, appropriate async and publisher ID, only on eligible pages/after legally required consent signals; avoid duplicate script injection.
- Decide between Google Auto ads and manually managed placements; don't accidentally double-load ads. Manual ad wrapper should respect slot lifecycle and avoid React Strict Mode duplicate initialization.
- Ads appear only on substantive public content. Never on admin, login, preview, search/404, empty category pages, privacy or other sensitive/low-value pages, downloadable-app-like UI, or content where placement creates accidental clicks.
- Use 0–2 restrained in-article slots initially subject to content length, visibility and policy, never force ads into every section. Ad count is a UX choice, not a magic approval threshold. Clearly label only with permitted descriptions such as `Advertisements` or `Sponsored Links`; no confusing images/buttons, overlays, prompts to click, fake download buttons, incentivized clicks, own ad clicks, auto-refresh or bot traffic.
- Reserve slots to avoid CLS, but do not create large empty ad-first screens; article content must remain the principal focus.
- Privacy policy must accurately disclose cookies, advertising, measurement, external vendors, how to control consent, contact and relevant data rights; generated legal text needs owner/legal review for applicable jurisdictions.
- For visitors in the EEA, UK and Switzerland, implement a **Google-certified CMP with IAB TCF integration** for AdSense where required; do not invent a home-made banner and falsely treat it as sufficient. Display consent and privacy controls and honor consent mode appropriately. Different jurisdictions may require additional handling.
- `/ads.txt` real publisher entry after registration, plus favicon, site verification code and HTTPS.
- Affiliate links clearly disclosed; `rel="sponsored"` (and `noopener noreferrer` for external new-tab links where appropriate), editorial independence, no misleading placements.
- Protect against invalid traffic: rate limiting and bot filtering at infrastructure edge, no auto-click scripts, no view inflation, no incentivized ad clicks; do not claim it is possible to eliminate all invalid traffic.

## 9. Editorial content strategy and competitor research

Do NOT scrape competitors' article text and publish it. Research competitors through search snippets, publicly permissible pages, RSS, metadata, sitemaps, and official documentation while respecting site terms, robots and copyright. Record competitors as internal research only: domain, target intent, article title, topic, date, whether page covers tested versions, what crucial reader questions remain unanswered, and opportunities to create truly original value. Do not mass harvest content, bypass access restrictions, or copy their screenshots. Verify keyword volume/difficulty with actual paid data sources when available; if unavailable, label topics as hypotheses.

Editorial pillars and proposed first articles:
1. `How to Fix a WordPress 500 Internal Server Error (Step-by-Step)`
2. `WooCommerce Checkout Not Working: 12 Tests to Run`
3. `Cloudflare SSL Redirect Loop: Identify and Fix the Cause`
4. `WordPress Emails Not Sending: SMTP, DNS and Deliverability Checklist`
5. `Next.js Build Running Out of Memory: Diagnosis and Safe Fixes`
6. `Nginx 502 Bad Gateway: Upstream Diagnostics`
7. `How to Verify a Stripe Webhook Signature in Node.js`
8. `How to Troubleshoot Revolut WooCommerce Payment Connection`
9. `Railway vs VPS for Hosting a Small Node.js Application`
10. `How to Fix Database Connection Pool Exhaustion in Next.js`
11. `WordPress to New Host Migration Checklist Without Downtime`
12. `Cloudflare DNS Propagation: Why Records Look Different`.

These titles are ideas, **not validated low-difficulty keywords**, and claims in each must be actually researched/tested before publication. Prioritize 6–12 high-quality first-party tutorials with original screenshots and tested commands over 100 generic articles. Add practical affiliate comparisons and hire-help CTA honestly; monetize with legitimate services/affiliates while organic display ad revenue develops.

Every publishing workflow should require: query/problem definition, first-hand testing or transparent sourcing, what the visitor needs before starting, safety note/backup, fixes in sensible order, verification of success, alternatives and failure modes, links to official documentation, editor review, correct author identity, appropriate disclosures, and scheduled review when software versions change. Avoid inventing success claims or version numbers.

## 10. Analytics and search performance

- Install GA4 with consent settings as applicable; capture pageview, `search`, `contact_submit`, `newsletter_confirm`, outbound affiliate click. Avoid tracking personal data such as passwords, email addresses in URLs or form contents.
- Integrate Google Search Console via verification and manually configured property; API sync optional only with proper OAuth scopes. Show metrics only if actually connected; otherwise show setup instructions or empty states.
- Admin SEO dashboard aggregates impressions, clicks, CTR, average position by page/query/date, with timestamp and data source visible when imported; do not promise fresh live rankings or infer exact traffic from estimates.
- Set up errors/uptime/404 monitoring; backlink/competitor metrics optional from explicitly connected services, never fake.
- Editorial KPI weekly review: published articles, indexed pages, search impressions/clicks, top queries, new backlinks (verified), contact leads, affiliate referrals, Core Web Vitals by device, ads policy warnings and revenue after approval.

## 11. Security, privacy, reliability

- Server-side role checks on every admin read/write, scoped permissions and protection against IDOR. Use secure authentication and password reset token hashing/expiry.
- Sanitize rich text; block XSS, SQL injection (parameterized ORM), SSRF from arbitrary URL fetcher, malicious file uploads, open redirects and redirect loops.
- Enforce CSP that accommodates only required AdSense/analytics/CMP third-party origins. Avoid broad `unsafe-inline` except when justified and documented; configure script nonces where feasible.
- Rate-limit login, contact, search and image upload endpoints; CAPTCHA or honeypot for contact forms only if needed; no Google ads on admin forms.
- Handle image storage and GDPR-consistent retention/deletion rules, secure logs, spam control and no sensitive PII in analytics.
- Configure backups, migration rollback plan, uptime checks, staging/prod env separation, incident errors, admin audit log.
- No runtime dependency on an unavailable paid service just to publish a post. Feature flags for optional integrations.

## 12. Testing and acceptance criteria — must pass before launch

Functional E2E:
- Admin can log in, create an article with formatted text, image, code block, author, category and metadata; save draft; preview; send for review; approve; publish; unpublish; schedule; edit; restore revision. Unauthorized users cannot perform privileged actions.
- Published article appears on home/category/search and sitemap, has correct metadata and readable URL; draft never appears publicly even when ID guessed, search queried, sitemap inspected or feed requested.
- Change published slug -> old URL permanent-redirects to new URL once; no loops; canonical updated.
- Scheduled publish executes once in production and updates caches/sitemaps.
- Contact form sends one email when valid; rejects spam/invalid payloads; newsletter double opt-in works; unsubscribing works.
- Every menu/footer link resolves and every legal page is present. All public screens tested at 320, 390, 768, 1024, 1440 widths.

SEO E2E:
- `robots.txt`, `sitemap.xml`, `ads.txt` respond correct status and content.
- All published canonical pages return HTML with title, description, canonical, OG data, one H1 and validated Article/Breadcrumb structured data.
- `/admin`, `/admin/login`, unpublished previews and internal search never indexed; preview requires auth or expiring token.
- Revalidate homepage, category pages, sitemaps and article pages on publishing. No duplicate paths or soft 404.
- No broken links, missing alt where image informative, invalid publication dates, unsupported schema claims.

AdSense E2E:
- Before publisher approval, ads disabled; no fake AdSense ID.
- Consent rules correctly apply, including certified CMP for target regions when required.
- On approved site with ID and permitted consent conditions, only eligible configured placements display; no ad near buttons/code-copy/search input; no forced clicks, refreshes or overlays.

Quality gates:
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, production `pnpm build` all pass.
- No hydration errors, no unhandled console warnings, no placeholder articles or secrets committed.
- Aim for Lighthouse >=90 Performance, >=95 Accessibility, >=95 Best Practices, >=95 SEO on representative pages in controlled lab tests, but prioritize real-user Core Web Vitals and do not misrepresent these numbers as Google's ranking requirements.
- Test XSS payload in rich text, unauthorized article update, image MIME spoofing, login brute-force handling, broken redirect cycle, scheduled publishing race, search escaping.

## 13. Deliverables

1. Complete working Next.js repository and `README.md` with local setup.
2. PostgreSQL Prisma schema/migrations/seeds (seed only sample categories and admin; no fake production articles).
3. Fully responsive custom editorial design + functional CMS publishing experience.
4. SEO implementation, sitemap/robots and valid structured data.
5. Policy-compliant AdSense-ready integration and ads.txt configuration guide, explicitly pending separate Google approval.
6. Search Console, GA4, CMP and optional affiliate integration guide.
7. Deployment instructions for Vercel/Railway, DNS, domain verification, secure env vars, storage and backups.
8. Automated test suite, deployment checklist, content publishing SOP and Google policy compliance checklist.
9. Screenshot comparison at agreed viewport sizes, documented residual issues and security notes.
10. A brief Phase 2 backlog, but do not leave any core MVP functional requirements incomplete.

## 14. Build execution order — no shortcuts

**Phase A: Foundation** — install supported Next.js, database, auth, design tokens, header/footer/page layouts, data model, deployable skeleton.

**Phase B: CMS** — admin login/RBAC, article list, rich editor, image upload, drafts, editorial workflow, revisions, publish scheduling, real page rendering.

**Phase C: SEO** — server metadata, canonical, article schema, breadcrumb schema, sitemap, robots, redirects, index controls, category pages, search, Search Console verification.

**Phase D: Monetization and legal** — affiliate disclosure, original legal page templates for legal review, consent CMP integration, AdSense feature flag, publisher ID + `ads.txt`, ad placement controls, contact lead flow.

**Phase E: QA and production** — mobile/accessibility audits, real workflow tests, CWV optimization, deployment/runbook, demo content (clearly labeled as demo, not published), documentation.

When implementing, proceed file by file. First present the data model and page/component route map. Then build and test working vertical features, avoiding disconnected scaffolding. Make reasonable implementation decisions and document them, while preserving the essential specification. Do not claim the website has been indexed, ranked, certified, or AdSense-approved unless verified by an actual external service after deployment.

## 15. Authoritative references to re-check at build/release time

- Google's people-first guidance: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google's SEO starter guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google's Article structured data: https://developers.google.com/search/docs/appearance/structured-data/article
- Next.js metadata: https://nextjs.org/docs/app/getting-started/metadata-and-og-images
- Next.js dynamic metadata: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Next.js robots: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
- AdSense eligibility: https://support.google.com/adsense/answer/9724
- AdSense site readiness: https://support.google.com/adsense/answer/7299563
- AdSense program policies: https://support.google.com/adsense/answer/48182
- AdSense ad placement: https://support.google.com/adsense/answer/1346295
- AdSense invalid traffic: https://support.google.com/adsense/answer/16737
- AdSense EEA/UK/Switzerland CMP: https://support.google.com/adsense/answer/13554116
- AdSense connect site / ads.txt: https://support.google.com/adsense/answer/7584263

**Final instruction:** Deliver a distinctive editorial publication and real authenticated publishing backend, not a shiny dummy template. Treat Google compliance as ongoing operations and external review, never as a guarantee.
