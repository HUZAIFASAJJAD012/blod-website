import Script from "next/script";

/**
 * Loaded only by eligible pages (substantive published articles). The fixed id
 * makes next/script de-duplicate it across client navigations.
 */
export function AdsenseScript({ publisherId }: { publisherId: string }) {
  return (
    <Script
      id="adsbygoogle-loader"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`}
    />
  );
}
