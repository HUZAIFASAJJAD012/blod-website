import Script from "next/script";

/**
 * GA4 with Google Consent Mode v2. Everything defaults to *denied*; a certified
 * CMP (configured in AdSense "Privacy & messaging" or a third-party TCF CMP via
 * CMP_SCRIPT_URL) is responsible for granting consent. Without a CMP, GA4 only
 * sends cookieless pings. No personal data is sent in events.
 */
export function Analytics({ measurementId, cmpScriptUrl }: { measurementId?: string; cmpScriptUrl?: string }) {
  if (!measurementId && !cmpScriptUrl) return null;
  return (
    <>
      <Script id="consent-defaults" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});
gtag('set','ads_data_redaction',true);gtag('set','url_passthrough',false);`}
      </Script>
      {cmpScriptUrl ? <Script id="cmp-loader" src={cmpScriptUrl} strategy="afterInteractive" /> : null}
      {measurementId ? (
        <>
          <Script id="ga4-loader" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`} strategy="afterInteractive" />
          <Script id="ga4-config" strategy="afterInteractive">
            {`gtag('js',new Date());gtag('config',${JSON.stringify(measurementId)},{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}
    </>
  );
}
