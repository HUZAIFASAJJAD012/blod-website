import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { TOOLS } from "@/components/tools/registry";
import { buildMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata({
    title: `Free troubleshooting tools & checklists | ${s.brand.name}`,
    description: "Working, no-signup tools for diagnosing website problems: an HTTP status code explainer plus DNS and SSL change checklists.",
    path: "/tools",
    siteName: s.brand.name,
  });
}

export default function ToolsPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ name: "Tools", path: "/tools" }]}
        eyebrow="Tools & checklists"
        title="Small tools that answer one question well"
        lead="Everything here works in your browser, needs no account, and sends nothing to our servers."
      />
      <div className="container-page">
        <ul className="grid gap-6 md:grid-cols-3">
          {TOOLS.map((t) => (
            <li key={t.slug}>
              <Link href={`/tools/${t.slug}`} className="block h-full rounded-[10px] border border-line bg-surface p-6 no-underline hover:border-ink">
                <span className="badge">{t.kind}</span>
                <h2 className="mt-3 text-[19px] font-semibold">{t.name}</h2>
                <p className="mt-2 text-[15px] text-muted">{t.summary}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-accent">
                  Open <ArrowRight size={14} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
