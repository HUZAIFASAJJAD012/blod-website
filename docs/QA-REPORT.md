# QA report

Run locally on macOS, Node 22.18, PostgreSQL 14.20, Next.js 16.4.5 production build.

## Quality gates

| Gate | Result |
| --- | --- |
| `pnpm lint` | pass (0 errors, 0 warnings) |
| `pnpm typecheck` | pass |
| `pnpm test` (Vitest) | 71 / 71 pass: 54 unit, 17 integration against a real Postgres test DB |
| `pnpm test:e2e` (Playwright, production build) | 46 / 46 passed on the last uninterrupted run. After the final small changes (header nav nowrap, test-setup refactor, a build-tracing hint), a re-run gave 38 passed, 2 failed, 6 skipped (the serial editorial suite skips its remaining steps after the first failure). Both failures were tests that straddled macOS sleep (4–15 min wall time against a 60s timeout, confirmed in `pmset -g log`). Re-run on a machine that stays awake (plugged in) to confirm a fully green result. |
| `pnpm build` | pass, 0 warnings. Public pages static/ISR; articles SSG/ISR; admin dynamic |

## What the automated suites prove

**Functional:** sign-in (generic errors, brute-force throttling), create article in TipTap (headings, code block, image upload with alt text), save draft (the draft URL 404s publicly), publish, full metadata + JSON-LD on the article page, appears on home/category/search/sitemap, slug change → one permanent hop + updated canonical, unpublish → 404 and gone from the sitemap, revision diff + confirmed restore, scheduling + cron publishing exactly once under concurrent calls (also covered by an integration test), contact validation + submit, newsletter double opt-in, every header/footer link resolves, every admin module reachable for the owner, redirect loop rejected.

**Security:** XSS payloads in rich text (stored and rendered), IDOR (author editing another's article), optimistic-lock conflicts, MIME spoofing (HTML/SVG renamed to PNG, type mismatch), SSRF address ranges, JSON-LD script breakout, unauthenticated and cross-origin upload attempts (401/403), rate-limit windows, search with hostile input.

**SEO:** robots/sitemap/ads.txt status and content, one H1 + title + description + canonical + OG on all main pages, noindex on admin/search/preview (meta and header), no soft 404s (unknown slug/category/tag/author, invalid `?page=`), trailing slash → single 308, security headers, strict nonce CSP on admin.

**AdSense:** no ad script and no `/ads.txt` without a real publisher ID; still off with an ID until approval + CMP are confirmed; no `ins.adsbygoogle` on articles before approval.

**Accessibility & responsive:** axe (WCAG 2.0/2.1/2.2 A+AA) shows no serious or critical violations on 8 representative pages, including the 404; skip link + focus; mobile drawer works with the keyboard; no horizontal page scroll at 320 / 390 / 768 / 1024 / 1440.

## Screenshots

`pnpm test:e2e` writes full-page screenshots to `tests/screenshots/` (git-ignored): home, category, tool and contact pages at all five widths, plus the admin editor at 1440 and 390.

## Bugs found and fixed during QA

- Root `not-found.tsx` read request headers, which made **every** public route dynamic (ISR silently disabled). 404 logging moved to a client beacon → pages are static/ISR again.
- `next start` doesn't serve files added to `/public` after build → local uploads now live in `storage/uploads` and are served by a route handler.
- ProseMirror `attrs` are null-prototype objects, which React's server-action serializer rejects → the editor sends plain JSON.
- Custom CSS was unlayered, so it overrode Tailwind utilities (contrast failure in the dark strip) → moved into `@layer base/components`.
- The header nav overflowed at 1024px → full nav from 1280px, drawer below.
- Secure `__Host-` cookie on plain-http builds → cookie security now follows `SITE_URL` (always secure on https).
- `useEditorState` never resolved in production → toolbar state derived directly from the editor.

## Residual issues / not verified here

- **Lighthouse / Core Web Vitals** were not measured in this environment. Run PageSpeed Insights on the deployed URL; field CWV need real traffic.
- **Real email delivery** (SMTP), **S3 presigned uploads** and the **certified CMP** need real credentials and were exercised only through unit/integration paths, not end-to-end.
- **Rich Results Test / Search Console** need a public URL.
- Visual review was done on the empty-site state (no published guides). Article-page visuals should be re-checked once real guides with screenshots exist.
- Category/tag/guides listings are rendered per request (they read `?page=`). Fine at launch scale; Phase 2 could move page 1 to ISR.
- Policy pages are templates and need legal review (the dashboard flags this until it's ticked).
