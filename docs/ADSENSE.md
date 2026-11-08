# AdSense: integration & compliance guide

Approval is decided by Google after review. Nothing in this codebase claims, simulates or verifies approval. Google publishes **no** minimum number of posts or traffic level. Re-check at release: [eligibility](https://support.google.com/adsense/answer/9724), [site readiness](https://support.google.com/adsense/answer/7299563), [program policies](https://support.google.com/adsense/answer/48182), [ad placement](https://support.google.com/adsense/answer/1346295), [invalid traffic](https://support.google.com/adsense/answer/16737), [EEA/UK/CH CMP](https://support.google.com/adsense/answer/13554116), [connect site / ads.txt](https://support.google.com/adsense/answer/7584263).

## How ads are gated

`getAdsRuntime()` (`src/lib/ads/config.ts`) returns *enabled* only when **all** of these hold:

1. `ADSENSE_PUBLISHER_ID` is a syntactically valid `ca-pub-…` in the environment (never in the DB, never invented);
2. Admin → Monetization → "Enable ads" is on;
3. an admin recorded that Google's approval email arrived (an editorial flag with a timestamp, labelled as unverified);
4. an admin confirmed a Google-certified CMP is live for EEA/UK/Switzerland.

Otherwise no ad script is injected anywhere and `/ads.txt` returns 404 (no fake entry).

## Steps

1. Publish original, tested guides with clear navigation, an About page, contact details and policies.
2. Apply at adsense.google.com and add the site. Google shows your publisher ID.
3. Set `ADSENSE_PUBLISHER_ID` and redeploy. `/ads.txt` now serves `google.com, pub-…, DIRECT, f08c47fec0942fa0`. Google's site-connection check can find the loader on article pages once ads are enabled; if you need the code on the site *during* review, use the ads.txt method or the meta-tag method that AdSense offers.
4. In AdSense → Privacy & messaging, create and publish a **GDPR message** (Google's certified CMP, IAB TCF). If you use a third-party certified CMP instead, set `CMP_SCRIPT_URL`.
5. After the approval email, tick the approval and CMP confirmations and enable ads.
6. Choose a mode:
   - **Manual** (default): create display ad units in AdSense and paste each unit ID into a placement. Only enabled placements with an ID render.
   - **Auto ads**: enable Auto ads in AdSense. The site loads the script only, and manual slots are not rendered, so ads never double-load.

## Placement rules enforced in code

- Ads load only on published, indexable articles above the word threshold (default 700). Never on admin, login, preview, search, 404, policy pages, category/tag lists or empty pages.
- 0–2 in-article slots (default 1), never in the first two blocks and never adjacent to code blocks, step lists, callouts, tables, images or embeds, so they stay away from copy buttons and the primary CTA.
- Fixed reserved heights per placement (mobile/desktop) to prevent CLS. The label is limited to "Advertisements" or "Sponsored Links".
- The `<ins>` push is guarded against React Strict Mode double initialisation. The loader is `next/script` `afterInteractive` with a fixed id (one copy).

## Never

Click your own ads, ask anyone to click, use auto-refresh, overlays, fake download buttons, incentivised clicks, bought or bot traffic, or ads on pages without substantive content. Use edge bot management and rate limiting. The app's own rate limits reduce abuse but can't eliminate invalid traffic.

## Affiliate links

Mark them in the editor link dialog ("Affiliate / sponsored"): they render with `rel="sponsored noopener noreferrer"`. Turn on the article's affiliate disclosure. The content check raises an **error** if sponsored links exist without a disclosure.
