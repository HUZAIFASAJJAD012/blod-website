#!/usr/bin/env node
/**
 * Production build wrapper (`pnpm build`).
 *
 * Public pages are prerendered (static/ISR), so `next build` must reach the database.
 * Railway builds run OUTSIDE the private network, so `postgres.railway.internal`
 * is unreachable there. Set DATABASE_BUILD_URL to the Postgres *public* URL
 * (Railway: DATABASE_BUILD_URL=${{Postgres.DATABASE_PUBLIC_URL}}) and this script:
 *   1. applies pending migrations, so the build never queries an old schema;
 *   2. runs `next build` against that URL.
 * At runtime the app keeps using DATABASE_URL (the fast private network).
 */
import { spawnSync } from "node:child_process";

const env = { ...process.env };

if (env.DATABASE_BUILD_URL) {
  env.DATABASE_URL = env.DATABASE_BUILD_URL;
  // Prisma uses the URL as given. Railway's public proxy works with or without TLS.
  run("pnpm", ["prisma", "migrate", "deploy"]);
} else if (/\.railway\.internal\b/.test(env.DATABASE_URL ?? "")) {
  console.error(
    "\n✖ DATABASE_URL points at Railway's private network, which builds cannot reach.\n" +
      "  Add this service variable in Railway and redeploy:\n\n" +
      "    DATABASE_BUILD_URL=${{Postgres.DATABASE_PUBLIC_URL}}\n",
  );
  process.exit(1);
}

run("pnpm", ["next", "build"]);

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
