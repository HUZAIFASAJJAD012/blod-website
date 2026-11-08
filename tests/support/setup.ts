import { vi } from "vitest";
import { testDatabaseUrl } from "./test-env";

process.env.DATABASE_URL = testDatabaseUrl();
process.env.SITE_URL = "https://fixlayer.test";
process.env.APP_SECRET ??= "test-secret-test-secret-test-secret-0123";
process.env.APP_ENCRYPTION_KEY ??= "test-encryption-key-test-encryption-key";
process.env.EMAIL_TRANSPORT = "log";

// Next.js cache APIs need a request/build context; record calls instead.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));
vi.spyOn(console, "info").mockImplementation(() => undefined);

// Request-scoped APIs used by server actions.
vi.mock("next/headers", () => {
  const jar = new Map<string, string>();
  return {
    headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "vitest" }),
    cookies: async () => ({
      get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
      set: (k: string, v: string) => void jar.set(k, v),
      delete: (k: string) => void jar.delete(k),
      has: (k: string) => jar.has(k),
    }),
  };
});
