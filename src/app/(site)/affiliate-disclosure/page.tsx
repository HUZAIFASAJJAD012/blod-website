import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHeader, ProseSection } from "@/components/site/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata({ title: `Affiliate disclosure | ${s.brand.name}`, description: "How affiliate links work on this site and how we keep recommendations independent.", path: "/affiliate-disclosure", siteName: s.brand.name });
}

export default async function AffiliateDisclosurePage() {
  const s = await getSettings();
  return (
    <>
      <PageHeader crumbs={[{ name: "Affiliate disclosure", path: "/affiliate-disclosure" }]} eyebrow="Transparency" title="Affiliate disclosure" />
      <ProseSection>
        <p>
          Some links on {s.brand.name} are affiliate links. If you click one and buy a product or service, the provider may pay us a commission. The price you pay is the same.
        </p>
        <h2>How you can tell</h2>
        <ul>
          <li>Any guide containing affiliate links shows a disclosure near the top of the page.</li>
          <li>Affiliate links are marked in the page source with <code className="inline-code">rel=&quot;sponsored&quot;</code>, as search engines ask.</li>
        </ul>
        <h2>How we stay independent</h2>
        <ul>
          <li>We decide what to recommend before looking at whether an affiliate programme exists.</li>
          <li>We include free and non-affiliate options when they are the right answer.</li>
          <li>Partners never review or approve our content before publication.</li>
        </ul>
        <p>
          Questions? <Link href="/contact?topic=partnership">Contact us</Link>.
        </p>
      </ProseSection>
    </>
  );
}
