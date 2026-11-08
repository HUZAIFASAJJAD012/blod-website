import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHeader, ProseSection } from "@/components/site/page-header";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata({
    title: `About ${s.brand.name}`,
    description: `Who writes ${s.brand.name}, how guides are tested, and how the site is funded.`,
    path: "/about",
    siteName: s.brand.name,
  });
}

export default async function AboutPage() {
  const s = await getSettings();
  const team = await db.authorProfile.findMany({
    where: { isPublic: true, user: { status: "ACTIVE" } },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <>
      <PageHeader crumbs={[{ name: "About", path: "/about" }]} eyebrow="About" title={`What ${s.brand.name} is for`} lead={s.brand.description} />
      <ProseSection>
        <p>
          {s.brand.name} is an independent publication about the unglamorous part of running websites: the error at 2 a.m., the checkout that silently stopped taking payments, the DNS change that broke email. We write for site owners, freelancers and agency developers who need to fix the problem <em>and</em> understand why it happened.
        </p>
        <h2>How guides are made</h2>
        <ul>
          <li>Each guide starts from a real problem — our own incidents, client work, or reader questions.</li>
          <li>Steps are reproduced on a test environment before publishing. When a guide was tested, it shows the exact versions in a <strong>Tested environment</strong> box.</li>
          <li>Claims we didn&apos;t test ourselves are linked to primary sources such as official documentation.</li>
          <li>Guides are reviewed when the software they cover changes, and the visible “Updated” date only changes when the content materially changes.</li>
        </ul>
        <p>
          Read the full <Link href="/editorial-policy">editorial policy</Link> and our <Link href="/corrections-policy">corrections policy</Link>.
        </p>
        <h2>How the site is funded</h2>
        <p>
          We may earn money from clearly disclosed affiliate links, from paid help with difficult incidents, and — if and when the site is approved — from display advertising. Money never decides what we recommend. See the <Link href="/affiliate-disclosure">affiliate disclosure</Link>.
        </p>
        <h2 id="team">Who writes here</h2>
        {team.length ? (
          <ul>
            {team.map((t) => (
              <li key={t.userId}>
                <Link href={`/authors/${t.slug}`}>{t.user.name}</Link>
                {t.roleTitle ? ` — ${t.roleTitle}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>Author profiles will appear here once they are published.</p>
        )}
        <h2>Contact</h2>
        <p>
          Questions, corrections or a problem you&apos;d like us to investigate? Use the <Link href="/contact">contact page</Link>
          {s.contact.publicEmail ? (
            <>
              {" "}
              or email <a href={`mailto:${s.contact.publicEmail}`}>{s.contact.publicEmail}</a>
            </>
          ) : null}
          .
        </p>
      </ProseSection>
    </>
  );
}
