# Search Console, GA4, CMP & affiliates

## Search Console

- Verify with a DNS TXT record (Domain property, preferred) or paste the meta-tag token into Admin → Settings → SEO & verification (it's rendered as `<meta name="google-site-verification">` on public pages).
- Submit `/sitemap.xml`. Re-submitting isn't needed after each publish; the sitemap's `lastModified` reflects real material updates.
- The CMS doesn't import Search Console data. Optional API sync (OAuth, read-only `webmasters.readonly` scope) is a Phase 2 item, and the dashboard says "not connected" instead of showing estimates.

## GA4

1. Create a GA4 property and web data stream, then copy the `G-…` ID into Admin → Settings → Analytics (or `GA4_MEASUREMENT_ID`).
2. The tag loads with **Consent Mode v2, everything denied by default** (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`), with ads data redaction on. Your CMP grants consent. Without a CMP, GA4 receives only cookieless pings.
3. Events sent (no personal data, no query text):
   - `page_view` (automatic)
   - `search` with `result_count`
   - `contact_submit`
   - `newsletter_confirm`
   - `affiliate_click`: wire it to outbound sponsored links if you need it (Phase 2 adds automatic tracking)
4. Mark `contact_submit` and `newsletter_confirm` as key events in GA4.

## CMP

- Google's own CMP: AdSense/Ad Manager → Privacy & messaging → GDPR message. It's delivered by the AdSense tag; no extra config here. Then tick "CMP confirmed" in Monetization.
- Third-party certified TCF CMP: set `CMP_SCRIPT_URL`. Its origin is added to the CSP automatically.
- The "Cookie preferences" page re-opens the CMP (`googlefc.showRevocationMessage()` or `__tcfapi('displayConsentUi')`).
- US state privacy laws may need extra messaging (e.g. CCPA opt-out), which Privacy & messaging also offers.

## Affiliates

Join programmes you'd recommend anyway. Disclose on the page, use `rel="sponsored"`, and never let a commission change a recommendation.
