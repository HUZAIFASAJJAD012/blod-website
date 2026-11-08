import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./test-env";

/** Applies migrations to the test database and wipes it before the suite. */
/** Migrate + wipe a test database (refuses anything not named *_test / *_e2e). */
export async function resetDatabase(url: string) {
  if (!/_(test|e2e)\b/.test(new URL(url).pathname)) throw new Error(`Refusing to reset a non-test database: ${url}`);
  const env = { ...process.env, DATABASE_URL: url };
  execSync("pnpm prisma migrate deploy", { env, stdio: "pipe" });
  const { Client } = await import("pg");
  const c = new Client({ connectionString: url });
  await c.connect();
  const { rows } = await c.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`);
  if (rows.length) await c.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await c.end();
}

/** Vitest globalSetup entry (Vitest passes its own context object as the first argument). */
export default async function setup() {
  await resetDatabase(testDatabaseUrl());
}
