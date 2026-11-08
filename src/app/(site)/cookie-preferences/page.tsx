import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHeader, ProseSection } from "@/components/site/page-header";
import { ConsentReopen } from "@/components/site/consent-reopen";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata({ title: `Cookie preferences | ${s.brand.name}`, description: "Review or change your cookie and consent choices.", path: "/cookie-preferences", index: false, siteName: s.brand.name });
}

export default async function CookiePreferencesPage() {
  const s = await getSettings();
  const cmp = s.monetization.cmpConfirmed || Boolean(process.env.CMP_SCRIPT_URL);
  return (
    <>
      <PageHeader crumbs={[{ name: "Cookie preferences", path: "/cookie-preferences" }]} eyebrow="Privacy" title="Cookie preferences" />
      <ProseSection>
        {cmp ? (
          <>
            <p>Consent is managed by a Google-certified consent management platform. Use the button below to review or withdraw your choices at any time.</p>
            <ConsentReopen />
          </>
        ) : (
          <p>
            This site currently sets no advertising or analytics cookies that require consent, so there is nothing to configure. If that changes, a certified consent tool will ask you first and this page will let you change your choices.
          </p>
        )}
        <p>
          More detail in the <Link href="/privacy-policy">privacy policy</Link>.
        </p>
      </ProseSection>
    </>
  );
}
