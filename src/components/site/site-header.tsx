import Link from "next/link";
import { getCategoriesWithCounts } from "@/server/articles/public";
import { getSettings } from "@/server/settings";
import { StickyHeader } from "./sticky-header";
import { MobileNav } from "./mobile-nav";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";

export async function SiteHeader() {
  const [categories, settings] = await Promise.all([getCategoriesWithCounts(), getSettings()]);
  const primary = categories.filter((c) => !c.parentId).slice(0, 4);
  const all = categories.filter((c) => !c.parentId);

  return (
    <StickyHeader>
      <div className="container-page flex h-full items-center gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 no-underline" aria-label={`${settings.brand.name} — home`}>
          <Logo text={settings.brand.logoText} />
        </Link>

        <nav aria-label="Primary" className="hidden min-w-0 flex-1 justify-center xl:flex">
          <ul className="flex items-center gap-5 whitespace-nowrap">
            {primary.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="nav-link">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/guides" className="nav-link">
                All guides
              </Link>
            </li>
          </ul>
        </nav>

        <div className="ml-auto hidden items-center gap-3 lg:flex xl:ml-0">
          <HeaderSearch />
          {settings.newsletter.enabled ? (
            <Link href="/#newsletter" className="btn btn-secondary btn-sm">
              Newsletter
            </Link>
          ) : null}
        </div>

        <div className="ml-auto lg:ml-0 xl:hidden">
          <MobileNav
            categories={all.map((c) => ({ name: c.name, slug: c.slug }))}
            newsletter={settings.newsletter.enabled}
          />
        </div>
      </div>
    </StickyHeader>
  );
}
