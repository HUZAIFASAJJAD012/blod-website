import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { AdminMobileNav, AdminSidebar, type NavItem } from "@/components/admin/admin-nav";
import { Logo } from "@/components/site/logo";
import { logoutAction } from "@/server/users/auth-actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const newInquiries = can(user, "inbox.view") ? await db.contactSubmission.count({ where: { status: "NEW" } }) : 0;

  const items: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "dashboard" },
    { href: "/admin/articles", label: "Articles", icon: "articles" },
    { href: "/admin/media", label: "Media", icon: "media" },
    ...(can(user, "taxonomy.manage") ? [{ href: "/admin/categories", label: "Categories & tags", icon: "categories" } as NavItem] : []),
    ...(can(user, "inbox.view") ? [{ href: "/admin/inbox", label: "Inbox", icon: "inbox", badge: newInquiries } as NavItem] : []),
    ...(can(user, "seo.view") ? [{ href: "/admin/seo", label: "SEO issues", icon: "seo" } as NavItem] : []),
    ...(can(user, "redirects.manage") ? [{ href: "/admin/redirects", label: "Redirects", icon: "redirects" } as NavItem] : []),
    ...(can(user, "users.manage") ? [{ href: "/admin/authors", label: "Authors & users", icon: "authors" } as NavItem] : [{ href: "/admin/profile", label: "My profile", icon: "authors" } as NavItem]),
    ...(can(user, "monetization.manage") ? [{ href: "/admin/monetization", label: "Monetization", icon: "monetization" } as NavItem] : []),
    ...(can(user, "settings.manage") ? [{ href: "/admin/settings", label: "Settings", icon: "settings" } as NavItem] : []),
    ...(can(user, "audit.view") ? [{ href: "/admin/audit-log", label: "Audit log", icon: "audit" } as NavItem] : []),
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 flex h-[72px] items-center gap-3 border-b border-line bg-surface px-4 lg:px-6">
        <AdminMobileNav items={items} />
        <Link href="/admin" className="no-underline" aria-label="Admin dashboard">
          <Logo />
        </Link>
        <span className="badge hidden sm:inline-flex">CMS</span>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/" target="_blank" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            View site <ExternalLink size={14} aria-hidden="true" />
          </Link>
          <Link href="/admin/profile" className="hidden text-right text-[13px] leading-tight no-underline md:block">
            <span className="block font-medium">{user.name}</span>
            <span className="mono-label text-muted">{user.role.toLowerCase()}</span>
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-secondary btn-sm" aria-label="Sign out">
              <LogOut size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>
      <div className="flex">
        <AdminSidebar items={items} />
        <div id="admin-main" className="min-w-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
