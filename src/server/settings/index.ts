import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Typed site settings. Each key has a Zod schema and defaults; stored JSON is
 * validated on read so a bad row can never break rendering. Secrets never live here.
 */
export const SETTINGS = {
  brand: z.object({
    name: z.string().min(1).max(60).default("FixLayer"),
    tagline: z.string().max(140).default("Practical fixes for websites, hosting and modern web apps."),
    description: z
      .string()
      .max(300)
      .default("Tested, step-by-step troubleshooting guides for WordPress, WooCommerce, hosting, Cloudflare, DNS, email and Node.js deployments."),
    organizationLegalName: z.string().max(120).default(""),
    logoText: z.string().max(30).default("FixLayer"),
  }),
  contact: z.object({
    publicEmail: z.string().max(200).default(""),
    postalAddress: z.string().max(400).default(""),
    responseTimeNote: z.string().max(200).default("We read every message. Replies usually take a few working days."),
    hireHelpEnabled: z.boolean().default(true),
  }),
  social: z.object({
    links: z.array(z.object({ label: z.string().max(40), url: z.string().url() })).max(10).default([]),
  }),
  seo: z.object({
    defaultTitleSuffix: z.string().max(60).default("FixLayer"),
    defaultDescription: z.string().max(300).default(""),
    googleSiteVerification: z.string().max(120).default(""),
    bingSiteVerification: z.string().max(120).default(""),
    includeTagPagesInSitemap: z.boolean().default(false),
    includeAuthorPagesInSitemap: z.boolean().default(true),
    staleAfterDays: z.number().int().min(30).max(1095).default(365),
  }),
  analytics: z.object({
    ga4MeasurementId: z.string().regex(/^(G-[A-Z0-9]+)?$/).default(""),
    firstPartyViewCounts: z.boolean().default(false),
  }),
  monetization: z.object({
    adsEnabled: z.boolean().default(false),
    mode: z.enum(["manual", "auto"]).default("manual"),
    // Editorial flag set by the owner after Google emails approval. It does NOT
    // reflect a live Google verification and is labelled as such in the UI.
    ownerConfirmedApproval: z.boolean().default(false),
    ownerConfirmedApprovalAt: z.string().nullable().default(null),
    cmpConfirmed: z.boolean().default(false),
    maxInArticleSlots: z.number().int().min(0).max(2).default(1),
    minWordsForAds: z.number().int().min(300).max(5000).default(700),
    adsLabel: z.enum(["Advertisements", "Sponsored Links"]).default("Advertisements"),
  }),
  newsletter: z.object({
    enabled: z.boolean().default(true),
    pitch: z.string().max(300).default("One email when we publish or materially update a guide. No tracking pixels, unsubscribe in one click."),
  }),
  legal: z.object({
    privacyLastUpdated: z.string().default(""),
    termsLastUpdated: z.string().default(""),
    governingLaw: z.string().max(120).default(""),
    reviewedByCounsel: z.boolean().default(false),
  }),
  homepage: z.object({
    heroEyebrow: z.string().max(60).default("INDEPENDENT WEB TROUBLESHOOTING"),
    heroTitle: z.string().max(90).default("Fix the problem. Understand the cause."),
    heroLead: z
      .string()
      .max(240)
      .default("Step-by-step fixes for WordPress, WooCommerce, hosting, Cloudflare and Node.js — written from real incidents, tested before publishing, and updated when software changes."),
    popularTopics: z.array(z.string().max(40)).max(8).default(["500 error", "SSL redirect loop", "SMTP", "502 Bad Gateway", "Webhooks"]),
  }),
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.output<(typeof SETTINGS)[K]>;

export const SETTINGS_TAG = "settings";

const loadAll = unstable_cache(
  async () => {
    const rows = await db.siteSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.valueJson]));
  },
  ["site-settings"],
  { tags: [SETTINGS_TAG], revalidate: 3600 },
);

export const getSettings = cache(async () => {
  let raw: Record<string, unknown> = {};
  try {
    raw = await loadAll();
  } catch (e) {
    console.error("[settings] falling back to defaults", e);
  }
  const out = {} as { [K in SettingKey]: SettingValue<K> };
  for (const key of Object.keys(SETTINGS) as SettingKey[]) {
    const parsed = SETTINGS[key].safeParse(raw[key] ?? {});
    (out as Record<string, unknown>)[key] = parsed.success ? parsed.data : SETTINGS[key].parse({});
  }
  return out;
});

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  return (await getSettings())[key];
}
