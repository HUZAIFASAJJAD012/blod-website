import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Parsed lazily so that `next build` of pages that do not
 * touch a given integration does not fail. Optional integrations are feature flags:
 * when their variables are absent, the feature is simply disabled.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  APP_ENCRYPTION_KEY: z.string().min(32),
  CRON_SECRET: z.string().min(16).optional(),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  MEDIA_PUBLIC_BASE_URL: z.string().optional(),

  EMAIL_TRANSPORT: z.enum(["log", "smtp"]).default("log"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("FixLayer <no-reply@localhost>"),
  CONTACT_INBOX: z.string().optional(),

  // AdSense publisher ID lives in env (server-side) — never invented, never in DB.
  ADSENSE_PUBLISHER_ID: z
    .string()
    .regex(/^ca-pub-\d{10,20}$/, "Must look like ca-pub-XXXXXXXXXXXXXXXX")
    .optional(),
  GA4_MEASUREMENT_ID: z.string().regex(/^G-[A-Z0-9]+$/).optional(),
  // Google-certified CMP script URL (e.g. from Funding Choices / your CMP vendor).
  CMP_SCRIPT_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(
    Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])),
  );
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function siteUrl(): string {
  return env().SITE_URL.replace(/\/+$/, "");
}

export const isProd = () => env().NODE_ENV === "production";
