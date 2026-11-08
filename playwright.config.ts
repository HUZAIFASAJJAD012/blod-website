import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./tests/support/test-env";

const PORT = Number(process.env.E2E_PORT ?? 3200);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * E2E runs against a production build (`next build && next start`) wired to the
 * dedicated E2E database, which tests/e2e/prepare-db.ts migrates, wipes and seeds before the build.
 */
export default defineConfig({
  testDir: "tests",
  testMatch: ["e2e/**/*.spec.ts", "seo/**/*.spec.ts", "accessibility/**/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm tsx tests/e2e/prepare-db.ts && pnpm next build && pnpm next start --port ${PORT}`,
        url: `${baseURL}/api/health`,
        timeout: 300_000,
        reuseExistingServer: false,
        env: {
          ...(process.env as Record<string, string>),
          DATABASE_URL: e2eDatabaseUrl(),
          SITE_URL: baseURL,
          NODE_ENV: "production",
          EMAIL_TRANSPORT: "log",
          CRON_SECRET: "e2e-cron-secret-0123456789",
          STORAGE_DRIVER: "local",
          DISALLOW_ALL_CRAWLERS: "0",
          E2E: "1",
        },
      },
});
