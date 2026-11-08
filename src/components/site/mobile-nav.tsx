"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, X } from "lucide-react";

export function MobileNav({ categories, newsletter }: { categories: { name: string; slug: string }[]; newsletter: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  return (
    <>
      <div className="flex items-center gap-1">
        <Link href="/search" className="btn btn-ghost h-11 w-11 p-0" aria-label="Search guides">
          <Search size={20} aria-hidden="true" />
        </Link>
        <button
          type="button"
          className="btn btn-ghost h-11 w-11 p-0"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-drawer"
          onClick={() => dialog.current?.showModal()}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      </div>
      <dialog
        id="mobile-drawer"
        ref={dialog}
        aria-label="Site menu"
        onClose={() => setOpen(false)}
        onToggle={() => setOpen(Boolean(dialog.current?.open))}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="m-0 ml-auto h-dvh max-h-dvh w-[min(88vw,360px)] max-w-none bg-canvas p-0 backdrop:bg-[rgba(17,24,32,0.5)]"
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <span className="eyebrow">Menu</span>
          <button type="button" className="btn btn-ghost h-11 w-11 p-0" aria-label="Close menu" onClick={() => dialog.current?.close()}>
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <form action="/search" method="get" role="search" className="border-b border-line p-4">
          <label htmlFor="drawer-q" className="field-label">
            Search guides
          </label>
          <input id="drawer-q" name="q" type="search" className="input" maxLength={120} placeholder="e.g. 502 bad gateway" />
        </form>
        <nav aria-label="Topics" className="p-4">
          <p className="eyebrow mb-2">Topics</p>
          <ul className="space-y-1">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="block rounded-md px-2 py-2.5 text-[15px] no-underline hover:bg-black/5">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className="eyebrow mt-6 mb-2">Site</p>
          <ul className="space-y-1">
            {[
              ["/guides", "All guides"],
              ["/tools", "Tools & checklists"],
              ["/about", "About"],
              ["/contact", "Contact"],
              ...(newsletter ? [["/#newsletter", "Newsletter"]] : []),
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="block rounded-md px-2 py-2.5 text-[15px] no-underline hover:bg-black/5">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </>
  );
}
