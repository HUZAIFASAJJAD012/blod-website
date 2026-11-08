import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/site/page-header";
import { getTool, TOOLS } from "@/components/tools/registry";
import { HttpStatusExplainer } from "@/components/tools/http-status-explainer";
import { Checklist } from "@/components/tools/checklist";
import { DNS_CHECKLIST, SSL_CHECKLIST } from "@/components/tools/checklists-data";
import { buildMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/server/settings";

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/tools/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  const s = await getSettings();
  return buildMetadata({ title: `${tool.name} | ${s.brand.name}`, description: tool.description, path: `/tools/${slug}`, siteName: s.brand.name });
}

export default async function ToolPage({ params }: PageProps<"/tools/[slug]">) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  return (
    <>
      <PageHeader crumbs={[{ name: "Tools", path: "/tools" }, { name: tool.name, path: `/tools/${slug}` }]} eyebrow={tool.kind} title={tool.name} lead={tool.description} />
      <div className="container-page">
        <div className="max-w-[730px]">
          {slug === "http-status-explainer" ? <HttpStatusExplainer /> : null}
          {slug === "dns-change-checklist" ? <Checklist storageKey="fl-dns-checklist" sections={DNS_CHECKLIST} /> : null}
          {slug === "ssl-certificate-checklist" ? <Checklist storageKey="fl-ssl-checklist" sections={SSL_CHECKLIST} /> : null}
          <p className="mt-10 border-t border-line pt-4 text-[14px] text-muted">
            This is general guidance. Always take a backup and confirm against your provider&apos;s documentation before making production changes.
          </p>
        </div>
      </div>
    </>
  );
}
