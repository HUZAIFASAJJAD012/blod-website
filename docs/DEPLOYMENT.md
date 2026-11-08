# Deployment

## Environments

| | Staging | Production |
| --- | --- | --- |
| Database | separate managed Postgres | managed Postgres with PITR backups |
| `SITE_URL` | `https://staging.example.com` | `https://www.example.com` (canonical) |
| `DISALLOW_ALL_CRAWLERS` | `1` | `0` |
| Ads / GA4 | off | after approval / when configured |
| Storage | separate bucket/prefix | production bucket behind a CDN |

Never point staging at the production database or bucket.

## Vercel

1. Import the repo. Framework preset: Next.js. Node 22.
2. Set every variable from `.env.example` (Production and Preview scopes separately). Use a **pooled** connection string (e.g. Neon/Supabase pooler, or Prisma Accelerate) and keep `DATABASE_POOL_MAX` small (3–5).
3. `vercel.json` already runs `prisma migrate deploy` before `next build` and registers a cron for `/api/cron` every minute. Per-minute crons need a paid plan; on Hobby use an external scheduler (see "Cron").
4. Set `STORAGE_DRIVER=s3`. The Vercel filesystem is read-only/ephemeral, so the local driver does not work there.
5. Add the domain. Point `www` (CNAME → `cname.vercel-dns.com`) and the apex (A → Vercel's IP or ALIAS). Choose one canonical host, set `SITE_URL` to it, and the proxy will 308 the other host (and `http://`) to it.

## Railway (or any Node host / VPS)

1. Create a Postgres service and a Node service from the repo.
2. Build: `pnpm install --frozen-lockfile && pnpm prisma migrate deploy && pnpm build`. Start: `pnpm next start --port $PORT`.
3. Health check path: `/api/health`.
4. Single instance with a persistent volume → `STORAGE_DRIVER=local` works (mount the volume at `storage/uploads`, or set `LOCAL_UPLOAD_DIR`). Multiple instances → use `s3`.
5. Add a Railway cron service (`* * * * *`) that runs `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://www.example.com/api/cron`.

## Cron (scheduled publishing, email retries, retention)

`/api/cron` publishes due scheduled articles, retries the email outbox, and deletes expired sessions/tokens, stale rate-limit buckets and contact messages older than 24 months. Every job is idempotent and safe to call concurrently. Any scheduler works: Vercel Cron, Railway cron, GitHub Actions `schedule`, cron-job.org, a systemd timer. The CMS dashboard warns if a scheduled article is more than 5 minutes overdue, which usually means the cron isn't running. No in-memory timers are used.

## Media storage (S3-compatible)

- Create a private bucket. Serve it publicly through a CDN/custom domain (`MEDIA_PUBLIC_BASE_URL`, `MEDIA_PUBLIC_HOST`).
- CORS on the bucket: allow `PUT` from your `SITE_URL` origin with `Content-Type`.
- Browsers upload with a 5-minute presigned PUT. The server then downloads the object, checks magic bytes and dimensions, and deletes it if invalid.
- Orphan cleanup: Admin → Media → "Clean up unused".

## DNS & email

- SPF, DKIM and DMARC for the sending domain used in `EMAIL_FROM` (your SMTP provider gives the records).
- `CAA` if you restrict certificate authorities.
- Keep TTLs low (300s) during the launch window.

## Backups & recovery

- Managed Postgres with daily snapshots + point-in-time recovery (7+ days).
- Weekly logical dump to separate storage: `pg_dump --format=custom "$DATABASE_URL" > fixlayer-$(date +%F).dump`.
- Media bucket: enable versioning or replication.
- **Restore drill (quarterly):** restore the latest dump into a scratch database, point a staging deploy at it, sign in, open an article.
- **Migration rollback:** migrations are forward-only SQL. Before risky ones, take a snapshot. To roll back, restore the snapshot and redeploy the previous commit. Keep schema changes additive (expand → migrate → contract) so the previous deploy still works.

## Monitoring

- Uptime: `/api/health` (checks the DB) from an external monitor every minute.
- Errors: wire Sentry or your host's log drain. Server logs never include passwords, tokens or form contents.
- 404s: Admin → SEO issues.

## Launch checklist

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build` all green
- [ ] Production env vars set; `APP_SECRET`/`APP_ENCRYPTION_KEY`/`CRON_SECRET` are unique random values
- [ ] `pnpm db:seed` run once; owner signed in, password changed, **2FA enabled**
- [ ] Brand name, trademark and domain checked; Settings → Brand/Contact/Legal filled
- [ ] Policies reviewed for your jurisdiction; "reviewed" box ticked in Settings → Legal
- [ ] Real author profiles published; no placeholder text anywhere
- [ ] First set of tested guides published (quality over count)
- [ ] `https://` canonical host, other host + `http` redirect in one hop (`curl -sI`)
- [ ] `/robots.txt`, `/sitemap.xml` reachable; staging has `DISALLOW_ALL_CRAWLERS=1`
- [ ] Search Console verified, sitemap submitted (see SEARCH-CONSOLE-GA4.md)
- [ ] Cron firing (dashboard shows a recent run)
- [ ] Backups verified with a restore drill
- [ ] Ads remain **off** until AdSense approval + CMP (see ADSENSE.md)
