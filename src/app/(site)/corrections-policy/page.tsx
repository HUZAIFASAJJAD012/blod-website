import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHeader, ProseSection } from "@/components/site/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata({ title: `Corrections policy | ${s.brand.name}`, description: "How to report an error and how we correct and label mistakes in our guides.", path: "/corrections-policy", siteName: s.brand.name });
}

export default function CorrectionsPolicyPage() {
  return (
    <>
      <PageHeader crumbs={[{ name: "Corrections policy", path: "/corrections-policy" }]} eyebrow="Standards" title="Corrections policy" lead="Technical guides go out of date and sometimes contain mistakes. Here's how we handle that." />
      <ProseSection>
        <h2>Reporting an error</h2>
        <p>
          Use the <Link href="/contact?topic=correction">contact form</Link> and choose “Report an error / correction”. Include the page and, if you can, the version of the software where the steps differ. Every report is read by an editor.
        </p>
        <h2>What we do</h2>
        <ul>
          <li><strong>Factual errors or unsafe steps</strong> are corrected as a priority. A visible <em>Correction</em> note at the end of the guide explains what was wrong.</li>
          <li><strong>Outdated steps</strong> (because software changed) are updated; the <em>Updated</em> date changes and we describe what changed.</li>
          <li><strong>Typos and formatting</strong> are fixed silently and do not change the updated date.</li>
        </ul>
        <p>If a guide can no longer be made accurate, we retire it and redirect readers to the best current guide, or mark the page as gone.</p>
        <h2>Revision history</h2>
        <p>We keep an internal revision history of every guide, so we can always see what was published and when.</p>
      </ProseSection>
    </>
  );
}
