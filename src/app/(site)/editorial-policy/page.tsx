import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHeader, ProseSection } from "@/components/site/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata({ title: `Editorial policy | ${s.brand.name}`, description: "How we research, test, review, date and update our troubleshooting guides.", path: "/editorial-policy", siteName: s.brand.name });
}

export default async function EditorialPolicyPage() {
  const s = await getSettings();
  return (
    <>
      <PageHeader crumbs={[{ name: "Editorial policy", path: "/editorial-policy" }]} eyebrow="Standards" title="Editorial policy" lead="What you can expect from every guide, and what we refuse to do." />
      <ProseSection>
        <h2>Every guide must</h2>
        <ol>
          <li><strong>Define the problem precisely</strong> — the symptom, the error text and who it affects.</li>
          <li><strong>Be tested or transparently sourced.</strong> Steps we ran ourselves are marked with a tested environment. Anything else links to a primary source.</li>
          <li><strong>Tell you what you need before you start</strong>, including backups and access requirements, before any risky step.</li>
          <li><strong>Order fixes sensibly</strong>: safe, reversible diagnostics first; destructive changes last.</li>
          <li><strong>Show how to verify success</strong> and what to do if a step fails.</li>
          <li><strong>Link to official documentation</strong> for the software involved.</li>
          <li><strong>Be reviewed by an editor</strong> before publication, under the real name of the person who wrote it.</li>
        </ol>
        <h2>Dates mean something</h2>
        <p>
          The <em>Published</em> date is when a guide first went live. The <em>Updated</em> date only changes when we make a material change — new steps, corrected facts, a new software version — and we say what changed. <em>Last tested</em> is the date we last ran the steps ourselves. We never refresh dates to look current.
        </p>
        <h2>Use of AI tools</h2>
        <p>
          We may use software tools, including AI assistants, for tasks like checking grammar or drafting an outline. A named human author is responsible for every guide, tests the steps, and verifies every claim. We do not publish unreviewed machine-generated articles.
        </p>
        <h2>Independence</h2>
        <p>
          Affiliate partners and advertisers have no say over what we write. We recommend the option we would use ourselves for the situation described, including free options. Affiliate links are disclosed on the page where they appear and marked with <code className="inline-code">rel=&quot;sponsored&quot;</code>. See the <Link href="/affiliate-disclosure">affiliate disclosure</Link>.
        </p>
        <h2>What we won&apos;t do</h2>
        <ul>
          <li>Copy or lightly rewrite other publishers&apos; articles or screenshots.</li>
          <li>Invent test results, version numbers, testimonials or author credentials.</li>
          <li>Publish thin pages to target search queries we haven&apos;t actually solved.</li>
        </ul>
        <h2>Corrections</h2>
        <p>
          If we get something wrong we fix it and say so. See the <Link href="/corrections-policy">corrections policy</Link>, or <Link href="/contact?topic=correction">report an error</Link>.
        </p>
        <p className="text-[14px] text-muted">This policy applies to all content published on {s.brand.name}.</p>
      </ProseSection>
    </>
  );
}
