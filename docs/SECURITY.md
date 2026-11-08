# Security notes

## Controls

| Threat | Control |
| --- | --- |
| Credential stuffing / brute force | scrypt (N=2¹⁷); per-IP (20/15 min) and per-account (8/15 min) limits in Postgres; generic errors; timing-equalised unknown users; optional TOTP MFA (secret AES-256-GCM encrypted) |
| Session theft | random 256-bit token, only its SHA-256 stored; `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix in prod; 14-day expiry; sessions revoked on password reset/change and suspension |
| CSRF | Server Actions: Next.js Origin/Host check. Route handlers with cookies (`/api/uploads`, `/api/preview`, forms) require same-origin `Origin`. `SameSite=Lax` cookies |
| IDOR / privilege escalation | every service checks `can()` / `canEditArticle()`; authors only load their own articles; only owners mint admins/owners; at least one owner always remains |
| XSS | TipTap JSON sanitized on save and render; renderer outputs React elements only (no HTML injection); links limited to http(s)/mailto/relative; images limited to our store/https; JSON-LD escapes `<>&`; inbox shows messages as text |
| Malicious uploads | magic-byte sniffing (PNG/JPEG/WebP/GIF/AVIF only, **no SVG**), declared-type mismatch rejected, 8 MB / 10k px caps; S3 objects re-verified server-side after presigned upload; served with `nosniff` and a sandbox CSP |
| SSRF (link checker) | http(s) only, ports 80/443, no credentials, every hop's DNS resolved and private/link-local/CGNAT/metadata ranges blocked, 5 redirects, 6s timeout, rate-limited |
| Open redirect | login `next` limited to `/admin…`; redirect targets must be `/path` or `https://`; contact `page` must be root-relative |
| Redirect loops | loop detection + chain collapsing on every write |
| SQL injection | Prisma parameterised queries; the few raw queries use tagged templates (bound parameters); search uses `websearch_to_tsquery` |
| Spam / abuse | honeypots, time-to-submit check, link/keyword heuristics, rate limits on contact/newsletter/search/upload/404 beacon |
| Data minimisation | IPs stored only as keyed HMAC hashes; analytics events carry no PII; 24-month contact retention; erase-by-email tool |
| Secrets | env only (validated by Zod); nothing secret in `site_settings`; `server-only` guards |

## CSP rationale

- **Admin** (always dynamic): `script-src 'self' 'nonce-…' 'strict-dynamic'`, generated per request in `proxy.ts`.
- **Public** pages are ISR-cached HTML, so a per-request nonce is impossible. They use `script-src 'self' 'unsafe-inline'` plus an explicit allowlist of Google ads/analytics/CMP origins. The risk is reduced by never rendering user-controlled HTML (the allowlist renderer), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and `frame-ancestors 'none'`. Trade-off: if you prefer strict CSP over static caching, make public routes dynamic and reuse the admin nonce path.

## Residual risks / operator responsibilities

- Link checker DNS-rebinding window between lookup and connect: run it from an egress-restricted environment if that matters.
- Rate limits are per-app. Put WAF/bot management (e.g. Cloudflare) in front for volumetric abuse and invalid ad traffic.
- Policy templates are not legal advice; have counsel review them.
- Enable 2FA for every editor/admin/owner.
- Rotate `APP_SECRET` (invalidates IP hashes only) and `CRON_SECRET` if leaked. Rotating `APP_ENCRYPTION_KEY` requires re-enrolling TOTP.
