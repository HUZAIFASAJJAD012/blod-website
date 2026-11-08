import Link from "next/link";
import { getCategoriesWithCounts } from "@/server/articles/public";
import { getSettings } from "@/server/settings";
import { Logo } from "./logo";

export async function SiteFooter() {
  const [categories, settings] = await Promise.all([getCategoriesWithCounts(), getSettings()]);
  const year = new Date().getFullYear();
  const cols: { heading: string; links: [string, string][] }[] = [
    {
      heading: "Topics",
      links: categories.filter((c) => !c.parentId).map((c) => [`/category/${c.slug}`, c.name] as [string, string]),
    },
    {
      heading: "Publication",
      links: [
        ["/guides", "All guides"],
        ["/tools", "Tools & checklists"],
        ["/about", "About FixLayer"],
        ["/editorial-policy", "Editorial policy"],
        ["/corrections-policy", "Corrections policy"],
        ["/contact", settings.contact.hireHelpEnabled ? "Contact & hire help" : "Contact"],
      ],
    },
    {
      heading: "Legal",
      links: [
        ["/privacy-policy", "Privacy policy"],
        ["/cookie-preferences", "Cookie preferences"],
        ["/terms", "Terms of use"],
        ["/affiliate-disclosure", "Affiliate disclosure"],
      ],
    },
  ];

  return (
    <footer className="mt-24 border-t border-line bg-[#F1F0EB]">
      <div className="container-page grid grid-cols-1 gap-10 py-14 md:grid-cols-12">
        <div className="md:col-span-4">
          <Logo text={settings.brand.logoText} />
          <p className="mt-4 max-w-sm text-[15px] text-muted">{settings.brand.description}</p>
          {settings.social.links.length ? (
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {settings.social.links.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="me noopener noreferrer" className="link-underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {cols.map((col) => (
          <nav key={col.heading} aria-label={`Footer: ${col.heading}`} className="md:col-span-2 lg:col-span-2 [&:nth-of-type(1)]:md:col-start-6">
            <h2 className="eyebrow mb-3">{col.heading}</h2>
            <ul className="space-y-2 text-[15px]">
              {col.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-ink/85 no-underline hover:text-accent">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-[13px] text-muted md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {settings.brand.organizationLegalName || settings.brand.name}. Independent publication; some links are affiliate links and are always disclosed.
          </p>
          <p className="mono-label">Guides are tested before publishing and reviewed when software changes.</p>
        </div>
      </div>
    </footer>
  );
}
