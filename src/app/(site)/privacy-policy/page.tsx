import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHeader, ProseSection } from "@/components/site/page-header";
import { formatDate } from "@/lib/utils/format";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return buildMetadata({ title: `Privacy policy | ${s.brand.name}`, description: "What data we collect, why, which vendors process it, how cookies and advertising work, and your rights.", path: "/privacy-policy", siteName: s.brand.name });
}

/**
 * Template text written to match what this codebase actually does. The site owner
 * must have it reviewed for their jurisdiction (tracked in admin → Settings → Legal).
 */
export default async function PrivacyPolicyPage() {
  const s = await getSettings();
  const controller = s.brand.organizationLegalName || s.brand.name;
  const adsOn = s.monetization.adsEnabled && s.monetization.ownerConfirmedApproval;
  const ga = Boolean(s.analytics.ga4MeasurementId || process.env.GA4_MEASUREMENT_ID);
  return (
    <>
      <PageHeader
        crumbs={[{ name: "Privacy policy", path: "/privacy-policy" }]}
        eyebrow="Legal"
        title="Privacy policy"
        lead={s.legal.privacyLastUpdated ? `Last updated ${formatDate(s.legal.privacyLastUpdated)}` : undefined}
      />
      <ProseSection>
        <h2>Who we are</h2>
        <p>
          This site is operated by {controller} (“we”), the controller of the personal data described here.
          {s.contact.postalAddress ? ` Postal address: ${s.contact.postalAddress}.` : ""} You can reach us through the <Link href="/contact?topic=privacy">contact form</Link>
          {s.contact.publicEmail ? <> or at <a href={`mailto:${s.contact.publicEmail}`}>{s.contact.publicEmail}</a></> : null}.
        </p>

        <h2>What we collect and why</h2>
        <div className="table-wrap" role="region" aria-label="Data we collect" tabIndex={0}>
          <table>
            <tbody>
              <tr><th scope="col">Data</th><th scope="col">Purpose</th><th scope="col">Legal basis (UK/EU GDPR)</th><th scope="col">Kept for</th></tr>
              <tr><td>Contact form: name, email, message, topic</td><td>Replying to you</td><td>Consent / legitimate interests</td><td>Up to 24 months, then deleted</td></tr>
              <tr><td>Newsletter: email, consent time, confirmation time</td><td>Sending the newsletter you asked for (double opt-in)</td><td>Consent</td><td>Until you unsubscribe, plus a record of the unsubscribe</td></tr>
              <tr><td>Keyed hash of your IP address</td><td>Rate limiting and spam/abuse prevention; the raw IP is not stored</td><td>Legitimate interests (security)</td><td>Hours to days</td></tr>
              <tr><td>Server logs from our hosting provider</td><td>Security, reliability</td><td>Legitimate interests</td><td>Per hosting provider retention</td></tr>
            </tbody>
          </table>
        </div>
        <p>We do not sell personal data. We never ask for passwords or payment details.</p>

        <h2>Cookies and similar technologies</h2>
        <p>
          Reading this site does not require any cookies from us. Logged-in staff receive a strictly necessary session cookie for the admin area. Interactive checklists remember your progress in your browser&apos;s local storage only; that data never leaves your device.
        </p>
        <p>
          {ga
            ? "We use Google Analytics 4 to understand which guides are useful. It runs in Google Consent Mode with analytics and advertising storage denied by default; analytics cookies are only set if you consent through our consent banner. Without consent Google may receive cookieless signals."
            : "We do not currently run third-party analytics."}
        </p>

        <h2>Advertising</h2>
        {adsOn ? (
          <p>
            We show ads served by Google AdSense. Google and its partners may use cookies or device identifiers to serve and measure ads and, where you consent, to personalise them. Visitors in the EEA, the UK and Switzerland are asked for consent through a Google-certified consent management platform. Learn how Google uses data at{" "}
            <a href="https://policies.google.com/technologies/partner-sites" rel="noopener noreferrer">policies.google.com/technologies/partner-sites</a> and control personalised ads at{" "}
            <a href="https://adssettings.google.com" rel="noopener noreferrer">adssettings.google.com</a>.
          </p>
        ) : (
          <p>We do not currently show third-party advertising. If that changes, this section will describe the vendors involved and how to control consent before any ad loads.</p>
        )}

        <h2>Embedded content</h2>
        <p>Videos are not loaded until you click them. Once loaded, the video provider (for example YouTube, via its privacy-enhanced domain) may set cookies under its own policy.</p>

        <h2>Processors we use</h2>
        <ul>
          <li>Hosting and database provider (stores the site and the data above).</li>
          <li>Email delivery provider (sends replies, confirmations and newsletters).</li>
          {ga ? <li>Google (analytics{adsOn ? " and advertising" : ""}).</li> : adsOn ? <li>Google (advertising).</li> : null}
        </ul>
        <p>Some processors may handle data outside your country; where required we rely on appropriate safeguards such as standard contractual clauses.</p>

        <h2>Your rights</h2>
        <p>
          Depending on where you live (for example under UK/EU GDPR or US state privacy laws), you may have the right to access, correct, delete or export your data, to object to or restrict processing, and to withdraw consent at any time. Use the <Link href="/contact?topic=privacy">contact form</Link> to make a request. You can also complain to your data protection authority (in the UK, the ICO).
        </p>
        <p>
          Manage cookie choices at any time on the <Link href="/cookie-preferences">cookie preferences</Link> page. Unsubscribe from the newsletter with the link in any email.
        </p>

        <h2>Children</h2>
        <p>This site is not directed at children under 16 and we do not knowingly collect their data.</p>

        <h2>Changes</h2>
        <p>We will update this page when our practices change and show the date of the last update at the top.</p>
      </ProseSection>
    </>
  );
}
