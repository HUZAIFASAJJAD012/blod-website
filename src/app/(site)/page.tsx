import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { getHomepageData } from "@/server/articles/public";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { DiagnosticPanel } from "@/components/site/diagnostic-panel";
import { CategoryIcon } from "@/components/site/category-icon";
import { CompactArticleCard, FeaturedArticleCard, GridArticleCard } from "@/components/article/article-cards";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { TOOLS } from "@/components/tools/registry";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata({
    title: `${s.brand.name} — ${s.brand.tagline}`,
    description: s.seo.defaultDescription || s.brand.description,
    path: "/",
    siteName: s.brand.name,
  });
}

const DEV_NOTES = [
  { label: "Which plugin broke it?", cmd: "wp plugin deactivate --all --skip-plugins", note: "WP-CLI · re-enable one at a time" },
  { label: "What does DNS really say?", cmd: "dig +short A example.com @1.1.1.1", note: "query a resolver directly, bypass cache" },
  { label: "Which certificate is served?", cmd: "openssl s_client -connect example.com:443 -servername example.com </dev/null | openssl x509 -noout -dates -issuer", note: "SNI-aware check" },
  { label: "Follow every redirect hop", cmd: "curl -sIL -o /dev/null -w '%{http_code} %{url_effective}\\n' http://example.com", note: "spot loops & chains" },
];

export default async function HomePage() {
  const [data, s] = await Promise.all([getHomepageData(), getSettings()]);
  const { hero } = { hero: s.homepage };
  const lead = data.recent[0] ?? data.featured[0];
  const supporting = data.recent.filter((a) => a.id !== lead?.id).slice(0, 4);
  const startHere = data.categories.filter((c) => !c.parentId).slice(0, 6);

  return (
    <>
      {/* 2. Hero */}
      <section aria-labelledby="hero-title" className="container-page pt-10 pb-12 lg:pt-12 lg:pb-14">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <p className="eyebrow">{hero.heroEyebrow}</p>
            <h1 id="hero-title" className="h1-display mt-4 max-w-[16ch]">
              {hero.heroTitle}
            </h1>
            <p className="mt-5 max-w-[56ch] text-[17px] leading-[1.65] text-muted">{hero.heroLead}</p>
            <form action="/search" method="get" role="search" className="mt-7 flex max-w-xl flex-col gap-3 sm:flex-row">
              <label htmlFor="hero-q" className="sr-only">
                Describe the error or problem
              </label>
              <div className="relative flex-1">
                <Search size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                <input id="hero-q" name="q" type="search" maxLength={120} placeholder="Paste the error message or describe the problem" className="input pl-10" />
              </div>
              <button type="submit" className="btn btn-primary">
                Find a fix
              </button>
            </form>
            {hero.popularTopics.length ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="mono-label mr-1 text-muted">Popular:</span>
                {hero.popularTopics.map((t) => (
                  <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="chip">
                    {t}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="lg:col-span-5">
            <DiagnosticPanel />
          </div>
        </div>
      </section>

      {/* 3. Topic band */}
      <nav aria-label="Browse by topic" className="border-y border-line bg-surface">
        <div className="container-page flex items-center gap-6 overflow-x-auto py-3.5 [scrollbar-width:none]">
          <span className="eyebrow shrink-0">Browse</span>
          <ul className="flex shrink-0 items-center gap-6">
            {data.categories
              .filter((c) => !c.parentId)
              .map((c) => (
                <li key={c.id}>
                  <Link href={`/category/${c.slug}`} className="nav-link whitespace-nowrap">
                    {c.name}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      </nav>

      {/* 4. Start here */}
      <section aria-labelledby="start-here" className="container-page py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <h2 id="start-here" className="h2-section">
              Start here
            </h2>
            <p className="mt-3 text-[15px] text-muted">Pick the layer that&apos;s failing. Each topic is a curated set of tested fixes, not a tag cloud.</p>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-2 lg:col-span-9 lg:grid-cols-3">
            {startHere.map((c) => (
              <li key={c.id} className="bg-surface">
                <Link href={`/category/${c.slug}`} className="group flex h-full flex-col p-6 no-underline transition-colors hover:bg-[#FBFAF7]">
                  <div className="flex items-center justify-between">
                    <span className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink">
                      <CategoryIcon name={c.icon} size={18} />
                    </span>
                    <span className="mono-label text-muted">{c.count === 0 ? "coming soon" : `${c.count} ${c.count === 1 ? "guide" : "guides"}`}</span>
                  </div>
                  <h3 className="mt-4 text-[17px] font-semibold">{c.name}</h3>
                  <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-[1.55] text-muted">{c.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-accent">
                    Open topic <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. Recently updated */}
      <section aria-labelledby="recent" className="container-page pb-16">
        <div className="mb-8 flex items-end justify-between gap-4 border-b border-line pb-4">
          <h2 id="recent" className="h2-section">
            Recently updated fixes
          </h2>
          <Link href="/guides" className="link-underline text-[15px]">
            All guides
          </Link>
        </div>
        {lead ? (
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <FeaturedArticleCard a={lead} />
            </div>
            <div className="grid content-start gap-x-8 gap-y-10 sm:grid-cols-2 lg:col-span-6">
              {supporting.map((a) => (
                <CompactArticleCard key={a.id} a={a} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState />
        )}
      </section>

      {/* 6. Most useful */}
      {data.useful.length ? (
        <section aria-labelledby="useful" className="container-page pb-16">
          <div className="mb-8 border-b border-line pb-4">
            <h2 id="useful" className="h2-section">
              Most useful guides
            </h2>
            <p className="mt-1 text-[14.5px] text-muted">Chosen by our editors as the guides we reach for most during real incidents.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.useful.map((a, i) => (
              <GridArticleCard key={a.id} a={a} index={i} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 7. Developer notes */}
      <section aria-labelledby="dev-notes" className="bg-code text-code-ink">
        <div className="container-page py-14">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow text-code-muted">Developer notes</p>
              <h2 id="dev-notes" className="h2-section mt-3 text-white">
                Four commands we run before touching anything
              </h2>
              <p className="mt-3 text-[15px] text-[#b9c4d0]">Gather evidence first. Each one answers a single question and changes nothing on the server.</p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
              {DEV_NOTES.map((n, i) => (
                <li key={n.label} className="rounded-[10px] border border-[#24303c] bg-[#151e28] p-4">
                  <p className="flex items-baseline gap-2 text-[15px] font-medium text-white">
                    <span className="mono-label text-[#6fa0ff]">{String(i + 1).padStart(2, "0")}</span>
                    {n.label}
                  </p>
                  <pre className="terminal mt-3 overflow-x-auto rounded-md bg-[#0c1218] p-3 text-[12.5px] whitespace-pre-wrap break-all">
                    <span className="prompt">$ </span>
                    {n.cmd}
                  </pre>
                  <p className="mono-label mt-2 text-code-muted">{n.note}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 8. Tools */}
      <section aria-labelledby="tools" className="container-page py-16">
        <div className="mb-8 flex items-end justify-between gap-4 border-b border-line pb-4">
          <h2 id="tools" className="h2-section">
            Free tools &amp; checklists
          </h2>
          <Link href="/tools" className="link-underline text-[15px]">
            All tools
          </Link>
        </div>
        <ul className="grid gap-6 md:grid-cols-3">
          {TOOLS.map((t) => (
            <li key={t.slug}>
              <Link href={`/tools/${t.slug}`} className="group block h-full rounded-[10px] border border-line bg-surface p-6 no-underline hover:border-ink">
                <span className="badge">{t.kind}</span>
                <h3 className="mt-3 text-[18px] font-semibold">{t.name}</h3>
                <p className="mt-1.5 text-[14.5px] leading-[1.55] text-muted">{t.summary}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-accent">
                  Open <ArrowRight size={14} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 9. Newsletter */}
      {s.newsletter.enabled ? (
        <section id="newsletter" aria-labelledby="nl-title" className="container-page scroll-mt-24">
          <div className="grid gap-8 rounded-[12px] border border-line bg-surface p-6 md:p-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="eyebrow">Newsletter</p>
              <h2 id="nl-title" className="h2-section mt-3">
                New fixes, when they&apos;re ready
              </h2>
              <p className="mt-3 text-[15px] text-muted">{s.newsletter.pitch}</p>
            </div>
            <div className="lg:col-span-7 lg:pt-8">
              <NewsletterForm source="homepage" />
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[10px] border border-dashed border-line-strong bg-surface p-10 text-center">
      <p className="text-[17px] font-medium">No guides published yet.</p>
      <p className="mt-2 text-[15px] text-muted">The first tested guides are in progress. Subscribe below to hear when they go live.</p>
    </div>
  );
}
