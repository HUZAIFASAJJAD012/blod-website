# Phase 2 backlog

The MVP requirements are implemented. These are the next improvements, roughly in priority order.

1. **Search Console API sync** (OAuth, read-only) → impressions/clicks/CTR/position by page and query, with source + import timestamp, in the SEO dashboard.
2. **Automatic `affiliate_click` events** on `rel=sponsored` links (consent-aware), plus a per-article outbound-click report.
3. **Image variants & crop UI**: pre-generated AVIF/WebP derivatives in the bucket and a visual crop tool (focal point is already stored).
4. **Newsletter sending**: compose/send digests to confirmed subscribers via a bulk-email provider, with per-message unsubscribe (tokens already exist).
5. **Editorial comments** on drafts (reviewer ↔ author threads), and assignment/due dates.
6. **Scheduled content re-verification reminders** emailed to authors when a guide goes stale.
7. **Sitemap index + `generateSitemaps()`** once the archive approaches 40k articles.
8. **Passkeys (WebAuthn)** in addition to TOTP.
9. **Per-article first-party view counts** (setting exists; aggregate-only daily counter, consent-aware).
10. **Hreflang / i18n** if non-English editions are added.
11. **External link-health cron** (weekly batch over all references, SSRF-safe checker already implemented).
12. **Visual regression baseline** comparing `tests/screenshots` across releases.
