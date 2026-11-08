"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BarChart3,
  FileText,
  FolderTree,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Menu,
  ScrollText,
  Settings,
  Shuffle,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

const ICONS = {
  dashboard: LayoutDashboard,
  articles: FileText,
  media: ImageIcon,
  categories: FolderTree,
  authors: Users,
  seo: BarChart3,
  redirects: Shuffle,
  monetization: Megaphone,
  settings: Settings,
  audit: ScrollText,
  inbox: Inbox,
} satisfies Record<string, LucideIcon>;

function NavList({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((it) => {
        const active = it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href);
        const Icon = ICONS[it.icon];
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-[14.5px] no-underline transition-colors ${
                active ? "bg-ink text-white" : "text-ink/80 hover:bg-black/5 hover:text-ink"
              }`}
            >
              <Icon size={17} aria-hidden="true" strokeWidth={1.8} />
              <span className="flex-1">{it.label}</span>
              {it.badge ? <span className={`rounded-full px-1.5 font-mono text-[11px] ${active ? "bg-white/20" : "bg-accent text-white"}`}>{it.badge}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminSidebar({ items }: { items: NavItem[] }) {
  return (
    <nav aria-label="Admin" className="sticky top-[72px] hidden h-[calc(100dvh-72px)] w-[248px] shrink-0 overflow-y-auto border-r border-line bg-[#F7F6F2] p-3 lg:block">
      <NavList items={items} />
    </nav>
  );
}

export function AdminMobileNav({ items }: { items: NavItem[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  useEffect(() => ref.current?.close(), [pathname]);
  return (
    <>
      <button type="button" className="btn btn-ghost h-10 w-10 p-0 lg:hidden" aria-label="Open admin menu" onClick={() => ref.current?.showModal()}>
        <Menu size={20} aria-hidden="true" />
      </button>
      <dialog ref={ref} aria-label="Admin menu" className="m-0 h-dvh max-h-dvh w-[280px] max-w-none bg-[#F7F6F2] p-3 backdrop:bg-black/40" onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="mb-3 flex justify-end">
          <button type="button" className="btn btn-ghost h-10 w-10 p-0" aria-label="Close menu" onClick={() => ref.current?.close()}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <NavList items={items} />
      </dialog>
    </>
  );
}
