import { z } from "zod";
import { isValidSlug } from "@/lib/utils/slug";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const isoDateOrNull = z
  .string()
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

export const ARTICLE_TYPES = ["TROUBLESHOOTING", "TUTORIAL", "COMPARISON", "CHECKLIST", "OPINION", "NEWS"] as const;
export const SCHEMA_TYPES = ["BLOG_POSTING", "ARTICLE", "NEWS_ARTICLE"] as const;
export const REFERENCE_TYPES = ["OFFICIAL_DOCS", "PRIMARY_SOURCE", "SECONDARY_SOURCE", "TOOL"] as const;

export const referenceInput = z.object({
  title: z.string().trim().min(1, "Reference title is required").max(300),
  url: z
    .string()
    .trim()
    .url("Reference URL must be a full URL")
    .max(2048)
    .refine((u) => /^https?:\/\//.test(u), "Only http(s) URLs"),
  publisher: optionalText(120),
  accessedAt: z.string().min(1, "Access date is required"),
  referenceType: z.enum(REFERENCE_TYPES).default("OFFICIAL_DOCS"),
  isPrimary: z.boolean().default(false),
});

/** Payload for save/autosave. Lenient enough for drafts; publish readiness is checked separately. */
export const articleInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .max(90)
    .refine(isValidSlug, "Slug must be lower-case words separated by hyphens (a-z, 0-9)."),
  excerpt: z.string().trim().max(500, "Keep the excerpt to 1–3 sentences (max 500 characters)."),
  primaryCategoryId: z.string().min(1, "Choose a primary category"),
  secondaryCategoryIds: z.array(z.string()).max(3).default([]),
  tagIds: z.array(z.string()).max(12).default([]),
  newTags: z.array(z.string().trim().min(2).max(40)).max(5).default([]),
  coverMediaId: z.string().nullable().optional(),
  ogImageId: z.string().nullable().optional(),
  bodyJson: z.unknown(),
  type: z.enum(ARTICLE_TYPES),
  schemaType: z.enum(SCHEMA_TYPES),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  relatedIds: z.array(z.string()).max(5, "At most 5 related articles").default([]),
  authorId: z.string().min(1),
  reviewerId: z.string().nullable().optional(),
  testedEnvironment: z
    .array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(120) }))
    .max(12)
    .default([]),
  verification: z
    .object({ stepsVerified: z.boolean().default(false), originalScreenshots: z.boolean().default(false), claimsSourced: z.boolean().default(false) })
    .default({ stepsVerified: false, originalScreenshots: false, claimsSourced: false }),
  references: z.array(referenceInput).max(40).default([]),
  lastVerifiedAt: isoDateOrNull,
  markMaterialUpdate: z.boolean().default(false),
  correctionsNote: optionalText(1000),
  revisionReason: optionalText(500),
  affiliateDisclosureFlag: z.boolean().default(false),
  affiliateDisclosureText: optionalText(600),
  metaTitle: optionalText(200),
  metaDescription: optionalText(320),
  searchIntent: optionalText(200),
  secondaryQueries: z.array(z.string().trim().max(160)).max(20).default([]),
  canonicalOverride: optionalText(2048),
  robotsIndex: z.boolean().default(true),
  robotsFollow: z.boolean().default(true),
  ogTitle: optionalText(200),
  ogDescription: optionalText(320),
  featuredOnHome: z.boolean().default(false),
  featuredRank: z.number().int().min(1).max(99).nullable().optional(),
  pinnedUntil: isoDateOrNull,
  brief: z
    .object({
      queryIntent: z.string().max(1000).default(""),
      competitorNotes: z.string().max(4000).default(""),
      unmetNeeds: z.string().max(2000).default(""),
      experiment: z.string().max(2000).default(""),
      difficulty: z.string().max(200).default(""),
    })
    .default({ queryIntent: "", competitorNotes: "", unmetNeeds: "", experiment: "", difficulty: "" }),
  createRedirectOnSlugChange: z.boolean().default(true),
});

export type ArticleInput = z.infer<typeof articleInput>;
export type ArticleInputRaw = z.input<typeof articleInput>;

export const WORKFLOW_ACTIONS = ["submit", "approve", "requestChanges", "publish", "schedule", "unpublish", "archive", "restoreDraft"] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];
