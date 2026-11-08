# FixLayer

A server-rendered technology troubleshooting publication with a built-in editorial CMS, in one Next.js App Router codebase.

> **FixLayer** is a working name. Check trademark and domain availability before launch.

Nothing in this codebase can guarantee search rankings or AdSense approval. Both are decided by Google. The code makes the site technically sound and policy-aware; the content still has to earn it.

## What's inside

| Area | Summary |
| --- | --- |
| Public site | Editorial homepage, guides with TOC / tested environment / references / author box / related, category & tag hubs, author pages, Postgres full-text search, 3 working tools, policy pages, real 404s |
| CMS (`/admin`) | RBAC (owner/admin/editor/author), TipTap editor with steps, callouts, code blocks, tables, images and citations, autosave with conflict detection, revisions with diff/restore, review → approve → publish/schedule workflow, media library, categories/tags, users & invitations, redirects, SEO issues dashboard, monetization, settings, inbox, audit log |
| SEO | Server metadata, canonical, OG/Twitter, Article/BlogPosting + BreadcrumbList + WebSite JSON-LD, sitemap of indexable URLs only, robots, slug-change 301s with loop/chain protection, noindex everywhere private, ISR + on-demand revalidation |
| Monetization | AdSense off by default; turns on only with a real publisher ID, owner-recorded approval and a confirmed certified CMP. `/ads.txt` is generated from the ID. Reserved slot heights, no ads near code/CTAs |
| Security | scrypt passwords, DB sessions (HttpOnly, SameSite, `__Host-`), TOTP MFA, Postgres-backed rate limits, CSRF origin checks, allowlist rich-text renderer, magic-byte upload validation, SSRF-safe link checker, CSP (strict nonce on admin), audit log |

## Stack

Next.js 16.4 (App Router, React 19.3, TypeScript strict) · Tailwind CSS 4 · PostgreSQL + Prisma 7 (driver adapter `pg`) · TipTap 3 · Zod 4 · Vitest · Playwright + axe.

## Local setup

Requirements: Node 20.9+ (tested on 22), pnpm 10+, PostgreSQL 14+.

```bash
pnpm install                      # also runs `prisma generate`
cp .env.example .env              # fill DATABASE_URL, APP_SECRET, APP_ENCRYPTION_KEY, CRON_SECRET, SEED_OWNER_*
pnpm db:deploy                    # apply migrations
pnpm db:seed                      # categories, disabled ad slots, owner account (no articles)
pnpm dev                          # http://localhost:3100  → admin at /admin
pnpm cron:local                   # optional: runs scheduled publishing + email outbox every minute
```

Want something to look at in the editor? `pnpm db:seed:demo` creates one draft clearly labelled `[DEMO]`. It is never published.

### Running Postgres just for this project (no Docker)

```bash
initdb -D .pgdata -U fixlayer --auth=trust && pg_ctl -D .pgdata -o "-p 5434 -k /tmp" -l .pgdata/server.log start
createdb -h localhost -p 5434 -U fixlayer fixlayer && createdb -h localhost -p 5434 -U fixlayer fixlayer_test
# DATABASE_URL="postgresql://fixlayer@localhost:5434/fixlayer"
```

## Quality gates

```bash
pnpm lint        # ESLint (Next + React Compiler rules)
pnpm typecheck   # route type generation + tsc --noEmit
pnpm test        # Vitest: unit + integration (uses the *_test database, wiped per run)
pnpm test:e2e    # Playwright: builds, starts on :3200 against the test DB, runs E2E/SEO/a11y + screenshots
pnpm build       # production build
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): data model, route map, caching, key decisions
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Vercel / Railway, DNS, env vars, storage, cron, backups, launch checklist
- [docs/SEO.md](docs/SEO.md): what's implemented, Search Console, sitemap submission, QA tools and their limits
- [docs/ADSENSE.md](docs/ADSENSE.md): AdSense application, ads.txt, CMP, placements, policy checklist
- [docs/SEARCH-CONSOLE-GA4.md](docs/SEARCH-CONSOLE-GA4.md): verification, GA4 with Consent Mode, events
- [docs/SECURITY.md](docs/SECURITY.md): threat model, controls, CSP rationale, residual risks
- [docs/CONTENT-SOP.md](docs/CONTENT-SOP.md): publishing SOP and competitor-research rules
- [docs/QA-REPORT.md](docs/QA-REPORT.md): test results, screenshots, known residual issues
- [docs/PHASE-2.md](docs/PHASE-2.md): backlog
