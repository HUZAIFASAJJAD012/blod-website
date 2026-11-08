/** Runs before `next build` in the Playwright webServer: migrate, wipe and seed the E2E database. */
import { execSync } from "node:child_process";
import { resetDatabase } from "../support/global-db";
import { e2eDatabaseUrl, TEST_OWNER } from "../support/test-env";

async function main() {
  // The Playwright webServer env already points DATABASE_URL at the E2E database.
  const url = process.env.E2E === "1" && process.env.DATABASE_URL ? process.env.DATABASE_URL : e2eDatabaseUrl();
  await resetDatabase(url);
  execSync("pnpm prisma db seed", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url, SEED_OWNER_EMAIL: TEST_OWNER.email, SEED_OWNER_PASSWORD: TEST_OWNER.password, SEED_OWNER_NAME: TEST_OWNER.name },
});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
