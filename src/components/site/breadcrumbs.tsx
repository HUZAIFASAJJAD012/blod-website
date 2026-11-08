import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbLd, type Crumb } from "@/lib/seo/jsonld";

/** Visible breadcrumbs + matching BreadcrumbList JSON-LD (schema mirrors what's shown). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ name: "Home", path: "/" }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-[13.5px] text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((c, i) => (
            <li key={c.path} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight size={13} aria-hidden="true" className="text-line-strong" /> : null}
              {i === all.length - 1 ? (
                <span aria-current="page" className="line-clamp-1 text-ink/80">
                  {c.name}
                </span>
              ) : (
                <Link href={c.path} className="no-underline hover:text-accent">
                  {c.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbLd(all)} />
    </>
  );
}
