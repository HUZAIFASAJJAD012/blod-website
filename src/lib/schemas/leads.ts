import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

export const newsletterSchema = z.object({
  email,
  consent: z.literal("yes", { message: "Please tick the consent box to subscribe." }),
  source: z.string().max(40).optional(),
  website: z.string().max(0, "Spam detected.").optional().or(z.literal("")),
});

export const CONTACT_TOPICS = ["question", "correction", "hire-help", "partnership", "privacy", "other"] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  email,
  topic: z.enum(CONTACT_TOPICS).default("question"),
  subject: z.string().trim().min(3, "Please add a short subject.").max(160),
  message: z
    .string()
    .trim()
    .min(20, "Please give a little more detail (at least 20 characters).")
    .max(5000, "Please keep messages under 5,000 characters."),
  pageUrl: z.string().max(300).optional(),
  consent: z.literal("yes", { message: "Please confirm we may use your details to reply." }),
  website: z.string().max(0).optional().or(z.literal("")), // honeypot
  startedAt: z.coerce.number().optional(), // render timestamp — submissions under 3s are bots
});

/** Very small heuristic spam score; real protection belongs at the edge (WAF/bot management). */
export function spamScore(message: string): number {
  let score = 0;
  const links = (message.match(/https?:\/\//g) ?? []).length;
  if (links > 3) score += 2;
  if (/\b(viagra|casino|crypto ?airdrop|seo backlinks?|guest post price)\b/i.test(message)) score += 3;
  if (/[Ѐ-ӿ]{20,}/.test(message) && links > 0) score += 1;
  return score;
}
