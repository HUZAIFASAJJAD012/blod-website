"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/content/extract";

/** Sticky desktop TOC with scroll-spy; collapsible <details> on mobile. */
export function TableOfContents({ items, variant }: { items: TocItem[]; variant: "desktop" | "mobile" }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (variant !== "desktop") return;
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items, variant]);

  if (items.length < 2) return null;

  const list = (
    <ol className="space-y-1.5 text-[14px] leading-[1.45]">
      {items.map((i) => (
        <li key={i.id} className={i.level === 3 ? "pl-3.5" : ""}>
          <a
            href={`#${i.id}`}
            aria-current={active === i.id ? "location" : undefined}
            className={`block border-l-2 py-0.5 pl-3 no-underline transition-colors ${
              active === i.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {i.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "mobile") {
    return (
      <details className="group rounded-[10px] border border-line bg-surface lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-2 font-medium">
          On this page
          <span aria-hidden="true" className="mono-label text-muted group-open:hidden">
            show
          </span>
          <span aria-hidden="true" className="mono-label hidden text-muted group-open:inline">
            hide
          </span>
        </summary>
        <nav aria-label="On this page" className="border-t border-line px-2 py-3">
          {list}
        </nav>
      </details>
    );
  }

  return (
    <nav aria-label="On this page" className="sticky top-24">
      <p className="eyebrow mb-3">On this page</p>
      {list}
    </nav>
  );
}
