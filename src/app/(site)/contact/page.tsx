import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHeader } from "@/components/site/page-header";
import { ContactForm } from "@/components/site/contact-form";
import { CONTACT_TOPICS } from "@/lib/schemas/leads";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata({
    title: `Contact ${s.brand.name}`,
    description: "Ask a question, report a correction or describe a problem you need help fixing.",
    path: "/contact",
    siteName: s.brand.name,
  });
}

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const sp = await searchParams;
  const s = await getSettings();
  const topic = typeof sp.topic === "string" && (CONTACT_TOPICS as readonly string[]).includes(sp.topic) ? sp.topic : "question";
  const page = typeof sp.page === "string" && sp.page.startsWith("/") && !sp.page.startsWith("//") ? sp.page.slice(0, 300) : "";

  return (
    <>
      <PageHeader
        crumbs={[{ name: "Contact", path: "/contact" }]}
        eyebrow="Contact"
        title="Tell us what's broken"
        lead={s.contact.responseTimeNote}
      />
      <div className="container-page grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ContactForm defaultTopic={topic} pageUrl={page} hireHelp={s.contact.hireHelpEnabled} />
        </div>
        <aside className="space-y-6 text-[15px] lg:col-span-4 lg:col-start-9">
          <section>
            <h2 className="text-[16px] font-semibold">Getting a useful answer</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>The exact error message (copy and paste, not a paraphrase).</li>
              <li>What changed just before it started.</li>
              <li>Your platform and versions: e.g. WordPress, PHP, host, CDN.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-[16px] font-semibold">Please don&apos;t send</h2>
            <p className="mt-2 text-muted">Passwords, API keys, private keys or customer data. We will never ask for them by email.</p>
          </section>
          {s.contact.publicEmail ? (
            <section>
              <h2 className="text-[16px] font-semibold">Email</h2>
              <p className="mt-2">
                <a href={`mailto:${s.contact.publicEmail}`} className="link-underline">
                  {s.contact.publicEmail}
                </a>
              </p>
            </section>
          ) : null}
          {s.contact.postalAddress ? (
            <section>
              <h2 className="text-[16px] font-semibold">Postal address</h2>
              <p className="mt-2 whitespace-pre-line text-muted">{s.contact.postalAddress}</p>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
