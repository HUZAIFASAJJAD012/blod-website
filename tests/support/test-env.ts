import "dotenv/config";

/** Tests always run against a separate database: DATABASE_URL_TEST, or <DATABASE_URL db>_test. */
export function testDatabaseUrl(): string {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Set DATABASE_URL or DATABASE_URL_TEST to run tests");
  const u = new URL(base);
  u.pathname = `${u.pathname.replace(/\/$/, "")}_test`;
  return u.toString();
}

/** Playwright uses its own database so ISR output never mixes with Vitest data. */
export function e2eDatabaseUrl(): string {
  if (process.env.DATABASE_URL_E2E) return process.env.DATABASE_URL_E2E;
  return testDatabaseUrl().replace(/_test(\?|$)/, "_e2e$1");
}

export const TEST_OWNER = { email: "owner@test.local", password: "test-Owner-password-2026", name: "Test Owner" };
