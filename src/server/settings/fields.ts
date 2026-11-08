import type { SettingKey } from "./index";

export type FieldSpec = {
  name: string;
  label: string;
  type: "text" | "textarea" | "bool" | "number" | "lines" | "links" | "select" | "date";
  hint?: string;
  options?: string[];
};

/** Declarative forms for each settings group (rendered by the settings page, parsed by the action). */
export const SETTINGS_FORMS: { key: SettingKey; title: string; description?: string; fields: FieldSpec[] }[] = [
  {
    key: "brand",
    title: "Brand",
    description: "FixLayer is a working name — confirm trademark and domain availability before launch.",
    fields: [
      { name: "name", label: "Site name", type: "text" },
      { name: "logoText", label: "Logo text", type: "text" },
      { name: "tagline", label: "Tagline", type: "text" },
      { name: "description", label: "Site description", type: "textarea" },
      { name: "organizationLegalName", label: "Legal entity name", type: "text", hint: "Organization structured data is only emitted once this is set." },
    ],
  },
  {
    key: "homepage",
    title: "Homepage",
    fields: [
      { name: "heroEyebrow", label: "Hero eyebrow", type: "text" },
      { name: "heroTitle", label: "Hero heading (H1)", type: "text" },
      { name: "heroLead", label: "Hero value proposition", type: "textarea" },
      { name: "popularTopics", label: "Popular topic chips (one per line, max 8)", type: "lines", hint: "Each chip links to a search." },
    ],
  },
  {
    key: "contact",
    title: "Contact & hire help",
    fields: [
      { name: "publicEmail", label: "Public contact email", type: "text" },
      { name: "postalAddress", label: "Postal address (if you must publish one)", type: "textarea" },
      { name: "responseTimeNote", label: "Response time note", type: "text" },
      { name: "hireHelpEnabled", label: "Offer paid help (“Need help fixing this?”)", type: "bool" },
    ],
  },
  {
    key: "social",
    title: "Social links",
    fields: [{ name: "links", label: "One per line: Label | https://…", type: "links" }],
  },
  {
    key: "seo",
    title: "SEO & verification",
    fields: [
      { name: "defaultTitleSuffix", label: "Title suffix", type: "text" },
      { name: "defaultDescription", label: "Default meta description", type: "textarea" },
      { name: "googleSiteVerification", label: "Google Search Console verification token", type: "text", hint: "Only the content value of the meta tag." },
      { name: "bingSiteVerification", label: "Bing Webmaster verification token", type: "text" },
      { name: "includeAuthorPagesInSitemap", label: "Include author pages in sitemap", type: "bool" },
      { name: "includeTagPagesInSitemap", label: "Include tag pages (3+ guides) in sitemap", type: "bool" },
      { name: "staleAfterDays", label: "Flag guides as stale after (days)", type: "number" },
    ],
  },
  {
    key: "analytics",
    title: "Analytics",
    fields: [
      { name: "ga4MeasurementId", label: "GA4 measurement ID (G-…)", type: "text", hint: "Loaded with Consent Mode v2, everything denied by default." },
      { name: "firstPartyViewCounts", label: "Count article views first-party (aggregate per day, no visitor IDs)", type: "bool" },
    ],
  },
  {
    key: "newsletter",
    title: "Newsletter",
    fields: [
      { name: "enabled", label: "Show newsletter sign-up", type: "bool" },
      { name: "pitch", label: "Sign-up text", type: "textarea", hint: "Never claim subscriber numbers you can't show." },
    ],
  },
  {
    key: "legal",
    title: "Legal",
    description: "Policy pages are templates matched to this software. They need review for your jurisdiction.",
    fields: [
      { name: "privacyLastUpdated", label: "Privacy policy last updated", type: "date" },
      { name: "termsLastUpdated", label: "Terms last updated", type: "date" },
      { name: "governingLaw", label: "Governing law (e.g. England and Wales)", type: "text" },
      { name: "reviewedByCounsel", label: "Policies have been reviewed by a qualified person", type: "bool" },
    ],
  },
];

export const MONETIZATION_FIELDS: FieldSpec[] = [
  { name: "adsEnabled", label: "Enable ads", type: "bool", hint: "Has no effect until a publisher ID is configured AND approval and CMP are confirmed below." },
  { name: "mode", label: "Ad mode", type: "select", options: ["manual", "auto"], hint: "Manual = only the placements below. Auto = Google Auto ads decides placement (manual slots are not rendered, to avoid double-loading)." },
  { name: "ownerConfirmedApproval", label: "I received Google's AdSense approval email for this domain", type: "bool", hint: "Editorial flag only — this CMS cannot verify approval with Google." },
  { name: "cmpConfirmed", label: "A Google-certified CMP (IAB TCF) is live for EEA/UK/Switzerland visitors", type: "bool", hint: "e.g. AdSense Privacy & messaging GDPR message published, or a certified third-party CMP via CMP_SCRIPT_URL." },
  { name: "maxInArticleSlots", label: "Max in-article ad slots (0–2)", type: "number" },
  { name: "minWordsForAds", label: "Minimum words before any ad shows", type: "number" },
  { name: "adsLabel", label: "Ad label", type: "select", options: ["Advertisements", "Sponsored Links"] },
];

export function parseFields(fields: FieldSpec[], fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = String(fd.get(f.name) ?? "");
    switch (f.type) {
      case "bool":
        out[f.name] = fd.get(f.name) === "on";
        break;
      case "number":
        out[f.name] = Number(raw);
        break;
      case "lines":
        out[f.name] = raw.split("\n").map((l) => l.trim()).filter(Boolean);
        break;
      case "links":
        out[f.name] = raw
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const [label, ...rest] = l.split("|");
            return { label: label!.trim(), url: rest.join("|").trim() };
          });
        break;
      default:
        out[f.name] = raw.trim();
    }
  }
  return out;
}
