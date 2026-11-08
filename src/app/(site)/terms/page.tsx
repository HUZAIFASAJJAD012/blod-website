import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHeader, ProseSection } from "@/components/site/page-header";
import { formatDate } from "@/lib/utils/format";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata({ title: `Terms of use | ${s.brand.name}`, description: "The terms for using this website and its guides.", path: "/terms", siteName: s.brand.name });
}

export default async function TermsPage() {
  const s = await getSettings();
  const owner = s.brand.organizationLegalName || s.brand.name;
  return (
    <>
      <PageHeader crumbs={[{ name: "Terms of use", path: "/terms" }]} eyebrow="Legal" title="Terms of use" lead={s.legal.termsLastUpdated ? `Last updated ${formatDate(s.legal.termsLastUpdated)}` : undefined} />
      <ProseSection>
        <h2>Using our guides</h2>
        <p>
          Guides are general technical information, provided in good faith. Systems differ: before following any step on a production system, make a backup and make sure you understand the change. You are responsible for changes you make to your own systems.
        </p>
        <h2>No warranty</h2>
        <p>
          To the extent permitted by law, the site is provided “as is” without warranties, and {owner} is not liable for loss arising from use of the information here. Nothing in these terms limits liability that cannot be limited by law.
        </p>
        <h2>Copyright</h2>
        <p>
          Text, diagrams and screenshots are owned by {owner} or used under licence, as credited. You may quote short excerpts with a link to the source page. Code snippets in guides may be used freely in your own projects.
        </p>
        <h2>External links</h2>
        <p>We link to third-party sites and documentation. We are not responsible for their content or availability. Some links are affiliate links — see the <Link href="/affiliate-disclosure">affiliate disclosure</Link>.</p>
        <h2>Acceptable use</h2>
        <p>Don&apos;t attempt to disrupt the site, scrape it at a volume that degrades service, or submit unlawful or abusive content through our forms.</p>
        {s.legal.governingLaw ? (
          <>
            <h2>Governing law</h2>
            <p>These terms are governed by the laws of {s.legal.governingLaw}.</p>
          </>
        ) : null}
        <h2>Contact</h2>
        <p>
          Questions about these terms: <Link href="/contact">contact us</Link>.
        </p>
      </ProseSection>
    </>
  );
}
