import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin requires authentication", async ({ page, request }) => {
  await page.goto("/admin/articles");
  await expect(page).toHaveURL(/\/admin\/login/);
  // Server actions / route handlers refuse unauthenticated writes too.
  const upload = await request.post("/api/uploads", { headers: { Origin: "http://localhost:3200" }, multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } } });
  expect(upload.status()).toBe(401);
  const xsite = await request.post("/api/uploads", { headers: { Origin: "https://evil.example" } });
  expect(xsite.status()).toBe(403);
});

test("wrong password shows a generic error and brute force is throttled", async ({ page }) => {
  await page.goto("/admin/login");
  for (let i = 0; i < 9; i++) {
    await page.getByLabel("Email").fill("victim@test.local");
    await page.getByLabel("Password", { exact: true }).fill(`wrong-password-${i}`);
    // Wait for each server-action round trip so every attempt is actually counted.
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Sign in" }).click()]);
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
  }
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(/Too many sign-in attempts/);
});

test("owner can reach every admin module", async ({ page }) => {
  await login(page);
  for (const [path, heading] of [
    ["/admin", /Hello/],
    ["/admin/articles", "Articles"],
    ["/admin/media", "Media"],
    ["/admin/categories", "Categories & tags"],
    ["/admin/authors", "Authors & users"],
    ["/admin/seo", "SEO issues"],
    ["/admin/redirects", "Redirects"],
    ["/admin/monetization", "Monetization"],
    ["/admin/settings", "Settings"],
    ["/admin/audit-log", "Audit log"],
    ["/admin/inbox", "Inbox"],
    ["/admin/profile", "Your profile"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("redirect manager rejects a loop", async ({ page }) => {
  await login(page);
  await page.goto("/admin/redirects");
  await page.getByLabel("From path").fill("/e2e-loop-a");
  await page.getByLabel("To (path or https URL)").fill("/e2e-loop-b");
  await page.getByRole("button", { name: "Add redirect" }).click();
  await expect(page.getByRole("status")).toContainText(/saved/i);
  await page.getByLabel("From path").fill("/e2e-loop-b");
  await page.getByLabel("To (path or https URL)").fill("/e2e-loop-a");
  await page.getByRole("button", { name: "Add redirect" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(/loop/i);
});

test("contact form sends and validates", async ({ page }) => {
  await page.goto("/contact?topic=hire-help");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toBeVisible();
  await page.getByLabel("Your name").fill("Pat Reader");
  await page.getByLabel("Email", { exact: true }).fill("pat@test.local");
  await page.getByLabel("Subject").fill("Checkout returns 500");
  await page.getByLabel("Message", { exact: true }).fill("After updating WooCommerce yesterday the checkout page returns a 500 error for every customer.");
  await page.getByLabel(/I agree that/).check();
  await page.waitForTimeout(3100); // human-speed submit (bots under 3s are flagged)
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Message sent")).toBeVisible();
});

test("newsletter signup uses double opt-in wording", async ({ page }) => {
  await page.goto("/");
  const form = page.locator("#newsletter");
  await form.getByLabel("Email address").fill(`reader-${Date.now()}@test.local`);
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Subscribe" }).click();
  await expect(form.getByRole("status")).toContainText(/confirmation link/);
});

test("every header and footer link resolves", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page.locator("header a[href^='/'], footer a[href^='/']").evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!.split("#")[0]!))]);
  expect(hrefs.length).toBeGreaterThan(10);
  for (const h of hrefs) {
    const r = await request.get(h || "/");
    expect(r.status(), h).toBeLessThan(400);
  }
});

test("HTTP status explainer works", async ({ page }) => {
  await page.goto("/tools/http-status-explainer");
  await page.getByLabel("Status code or name").fill("502");
  await expect(page.getByRole("heading", { name: "Bad Gateway" }).first()).toBeVisible();
});
