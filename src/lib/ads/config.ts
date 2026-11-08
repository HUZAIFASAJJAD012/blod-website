import "server-only";
import { getSettings } from "@/server/settings";
import { db } from "@/lib/db";

export type AdsRuntime =
  | { enabled: false; reason: string }
  | {
      enabled: true;
      publisherId: string;
      mode: "manual" | "auto";
      label: "Advertisements" | "Sponsored Links";
      maxInArticleSlots: number;
      minWords: number;
      placements: { key: string; adUnitId: string; minHeightDesktop: number; minHeightMobile: number; minWords: number | null }[];
    };

/**
 * Single source of truth for whether ads may load. Every condition must hold:
 *  1. A real publisher ID is configured server-side (env), never invented.
 *  2. The owner enabled ads in admin.
 *  3. The owner recorded that Google approved the site (editorial flag only).
 *  4. The owner confirmed a Google-certified CMP is live for EEA/UK/CH traffic.
 * Anything else → ads are off and no ad script is injected.
 */
export async function getAdsRuntime(): Promise<AdsRuntime> {
  const publisherId = process.env.ADSENSE_PUBLISHER_ID;
  if (!publisherId || !/^ca-pub-\d{10,20}$/.test(publisherId)) return { enabled: false, reason: "No AdSense publisher ID configured." };
  const { monetization: m } = await getSettings();
  if (!m.adsEnabled) return { enabled: false, reason: "Ads are switched off in admin." };
  if (!m.ownerConfirmedApproval) return { enabled: false, reason: "Owner has not recorded AdSense approval." };
  if (!m.cmpConfirmed) return { enabled: false, reason: "Certified consent platform not confirmed." };
  const placements = await db.adPlacement.findMany({ where: { enabled: true, adUnitId: { not: null } } });
  return {
    enabled: true,
    publisherId,
    mode: m.mode,
    label: m.adsLabel,
    maxInArticleSlots: m.maxInArticleSlots,
    minWords: m.minWordsForAds,
    placements: placements.map((p) => {
      const pos = (p.positions ?? {}) as { minHeightDesktop?: number; minHeightMobile?: number };
      return {
        key: p.key,
        adUnitId: p.adUnitId!,
        minHeightDesktop: pos.minHeightDesktop ?? 280,
        minHeightMobile: pos.minHeightMobile ?? 250,
        minWords: p.minContentThreshold,
      };
    }),
  };
}

/** Placement keys the article template knows how to render. */
export const PLACEMENT_KEYS = ["article_after_intro", "article_mid_content", "article_before_related"] as const;
