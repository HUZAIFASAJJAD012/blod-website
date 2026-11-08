/**
 * Seeds ONLY structural data: editorial categories, the owner account and
 * (disabled) ad placement slots. It never creates published articles.
 * Run: pnpm db:seed   (idempotent — safe to re-run)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword, passwordProblems } from "../src/lib/auth/password";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const CATEGORIES = [
  {
    slug: "wordpress",
    name: "WordPress",
    icon: "wordpress",
    description: "White screens, 500 errors, plugin conflicts, updates gone wrong and performance problems on self-hosted WordPress.",
    intro:
      "Most WordPress failures come from a small set of causes: a plugin or theme change, PHP limits, file permissions or a broken rewrite rule. These guides start with the evidence — logs and recent changes — before touching anything.",
  },
  {
    slug: "woocommerce",
    name: "WooCommerce",
    icon: "woocommerce",
    description: "Checkout failures, payment gateway errors, order emails, stock sync and performance for WooCommerce stores.",
    intro: "When a store stops taking orders, every hour costs money. These guides prioritise quick, safe tests that narrow down whether the fault is the theme, a plugin, the gateway or the server.",
  },
  {
    slug: "hosting-servers",
    name: "Hosting & Servers",
    icon: "server",
    description: "Nginx and Apache errors, PHP-FPM, VPS setup, migrations between hosts and server resource limits.",
    intro: "From 502 Bad Gateway to migrations without downtime: practical server-side diagnostics for shared hosting, managed platforms and VPS.",
  },
  {
    slug: "cloudflare-dns",
    name: "Cloudflare & DNS",
    icon: "cloud",
    description: "DNS records, propagation, Cloudflare SSL modes, redirect loops, caching rules and 52x errors.",
    intro: "DNS and CDN problems often look like application bugs. These guides show how to query the right server directly and read what is really happening.",
  },
  {
    slug: "nextjs-nodejs",
    name: "Next.js & Node.js",
    icon: "nodejs",
    description: "Build failures, memory limits, deployment to Vercel, Railway and VPS, database connections and runtime errors.",
    intro: "Deploying modern JavaScript apps means build-time and runtime constraints that differ by platform. These guides explain the cause, not just the flag that hides it.",
  },
  {
    slug: "payments-webhooks",
    name: "Payments & Webhooks",
    icon: "payments",
    description: "Stripe and other gateway integrations, webhook signatures, retries, idempotency and payment connection problems.",
    intro: "Payment integrations fail quietly. These guides cover signature verification, retries and the logs to check when money isn't arriving.",
  },
  {
    slug: "email-deliverability",
    name: "Email & Deliverability",
    icon: "mail",
    description: "SMTP setup, WordPress emails not sending, SPF, DKIM, DMARC and messages landing in spam.",
    intro: "Most 'email not sending' problems are either the site never handing mail to a real SMTP server, or the receiving server rejecting it. We separate the two.",
  },
  {
    slug: "tools-checklists",
    name: "Tools & Checklists",
    icon: "tools",
    description: "Reusable checklists and reference material for migrations, launches, DNS changes and incident response.",
    intro: "Checklists we actually use before risky changes. Print them, adapt them, and run them before you need them.",
  },
];

const PLACEMENTS = [
  { key: "article_after_intro", label: "In-article: after the introduction", minContentThreshold: 700 },
  { key: "article_mid_content", label: "In-article: mid content (long guides only)", minContentThreshold: 1500 },
  { key: "article_before_related", label: "After article, before related guides", minContentThreshold: 700 },
];

async function main() {
  for (const [i, c] of CATEGORIES.entries()) {
    await db.category.upsert({ where: { slug: c.slug }, create: { ...c, sortOrder: i }, update: {} });
  }
  for (const p of PLACEMENTS) {
    await db.adPlacement.upsert({
      where: { key: p.key },
      create: { ...p, enabled: false, positions: { minHeightDesktop: 280, minHeightMobile: 250, format: "auto" } },
      update: {},
    });
  }

  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  const name = process.env.SEED_OWNER_NAME?.trim() || "Site Owner";
  if (email && password) {
    const problem = passwordProblems(password);
    if (problem) throw new Error(`SEED_OWNER_PASSWORD: ${problem}`);
    const existing = await db.user.findUnique({ where: { email } });
    if (!existing) {
      const user = await db.user.create({ data: { email, name, role: "OWNER", status: "ACTIVE", passwordHash: await hashPassword(password) } });
      // Profile stays private until the owner writes a real bio.
      await db.authorProfile.create({ data: { userId: user.id, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "owner", isPublic: false } });
      console.log(`Created owner account ${email}. Change the password after first sign-in.`);
    } else {
      console.log(`Owner ${email} already exists — left unchanged.`);
    }
  } else {
    console.log("SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD not set — skipped owner creation.");
  }
  console.log(`Seeded ${CATEGORIES.length} categories and ${PLACEMENTS.length} (disabled) ad placements.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
