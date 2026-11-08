import type { Crumb } from "@/lib/seo/jsonld";
import { Breadcrumbs } from "./breadcrumbs";

export function PageHeader({
  crumbs,
  eyebrow,
  title,
  lead,
  children,
}: {
  crumbs: Crumb[];
  eyebrow?: string;
  title: string;
  lead?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="container-page pt-8 pb-10 lg:pt-10">
      <Breadcrumbs items={crumbs} />
      {eyebrow ? <p className="eyebrow mt-8">{eyebrow}</p> : null}
      <h1 className={`h1-display max-w-[22ch] ${eyebrow ? "mt-3" : "mt-8"}`}>{title}</h1>
      {lead ? <div className="mt-4 max-w-[64ch] text-[17px] leading-[1.65] text-muted">{lead}</div> : null}
      {children}
    </header>
  );
}

/** Long-form static pages (policies, about): same measure as articles. */
export function ProseSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page">
      <div className="prose-article max-w-[730px]">{children}</div>
    </div>
  );
}
