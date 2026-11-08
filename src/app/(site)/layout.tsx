import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Analytics } from "@/components/site/analytics";
import { JsonLd } from "@/components/seo/json-ld";
import { getSettings } from "@/server/settings";
import { organizationLd, websiteLd } from "@/lib/seo/jsonld";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s.brand.name, template: `%s | ${s.seo.defaultTitleSuffix}` },
    description: s.seo.defaultDescription || s.brand.description,
    verification: {
      ...(s.seo.googleSiteVerification ? { google: s.seo.googleSiteVerification } : {}),
      ...(s.seo.bingSiteVerification ? { other: { "msvalidate.01": s.seo.bingSiteVerification } } : {}),
    },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const ga4 = settings.analytics.ga4MeasurementId || process.env.GA4_MEASUREMENT_ID || undefined;
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter />
      <JsonLd data={websiteLd(settings.brand.name, settings.brand.description)} />
      {settings.brand.organizationLegalName ? (
        <JsonLd
          data={organizationLd({
            name: settings.brand.name,
            legalName: settings.brand.organizationLegalName,
            email: settings.contact.publicEmail || undefined,
            sameAs: settings.social.links.map((l) => l.url),
          })}
        />
      ) : null}
      <Analytics measurementId={ga4} cmpScriptUrl={process.env.CMP_SCRIPT_URL || undefined} />
    </>
  );
}
