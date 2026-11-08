import { expect, test } from "@playwright/test";
import { login, PNG_1x1 } from "./helpers";

const stamp = Date.now().toString(36);
const TITLE = `E2E guide: fix the ${stamp} gateway error`;
const SLUG = `e2e-guide-fix-the-${stamp}-gateway-error`;
const BODY = "This guide is an automated end-to-end test article. It walks through checking the upstream service, reading the proxy logs, and confirming the fix with a fresh request. ".repeat(6);

test.describe.serial("editorial lifecycle", () => {
  test("create → format → upload → save → publish", async ({ page }) => {
    await login(page);
    await page.goto("/admin/articles/new");
    await page.getByLabel("Title").fill(TITLE);
    await expect(page.locator("#slug")).toHaveValue(SLUG);
    await page.getByLabel("Excerpt / deck").fill("Diagnose the upstream, read the logs, and verify the fix.");

    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type(BODY);
    await page.getByRole("button", { name: "Heading 2" }).click();
    await page.keyboard.press("Enter");
    await page.keyboard.type("Check the upstream");
    await page.getByRole("button", { name: "Heading 2" }).click();
    await page.keyboard.press("Enter");
    await page.keyboard.type("Run the command below.");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Code block" }).click();
    await page.keyboard.type("curl -sI https://example.com");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");

    // Image upload through the media picker (alt text required).
    await page.getByRole("button", { name: "Image", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Choose an image" });
    await dialog.locator("#mp-file").setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: PNG_1x1 });
    await dialog.getByLabel("Alt text").fill("Terminal output showing HTTP 502 from the proxy");
    await dialog.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(editor.locator("img[alt='Terminal output showing HTTP 502 from the proxy']")).toBeVisible();

    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/\/admin\/articles\/[a-z0-9]+\/edit/, { timeout: 20_000 });
    await expect(page.getByRole("status").filter({ hasText: "Saved" }).first()).toBeVisible();

    // Drafts are invisible publicly even with the exact URL.
    const draft = await page.request.get(`/guides/${SLUG}`);
    expect(draft.status()).toBe(404);

    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText(/status is now published/i)).toBeVisible({ timeout: 20_000 });
  });

  test("published article renders with full SEO metadata", async ({ page }) => {
    const res = await page.goto(`/guides/${SLUG}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(TITLE);
    await expect(page).toHaveTitle(new RegExp(TITLE.slice(0, 20)));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Diagnose the upstream/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/guides/${SLUG}$`));
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /E2E guide/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/);
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = ld.map((t) => JSON.parse(t)["@type"]);
    expect(types).toEqual(expect.arrayContaining(["BlogPosting", "BreadcrumbList", "WebSite"]));
    const article = ld.map((t) => JSON.parse(t)).find((d) => d["@type"] === "BlogPosting");
    expect(article.headline).toBe(TITLE);
    expect(article.author.name).toBeTruthy();
    expect(new Date(article.datePublished).getTime()).toBeLessThanOrEqual(Date.now());
    await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "On this page" }).first()).toBeAttached();
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0); // no ads without approval
  });

  test("appears on home, category, search and sitemap", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: TITLE }).first()).toBeVisible();
    await page.goto("/category/wordpress");
    await expect(page.getByRole("link", { name: TITLE }).first()).toBeVisible();
    await page.goto(`/search?q=${stamp}`);
    await expect(page.getByRole("link", { name: TITLE })).toBeVisible();
    const sm = await (await request.get("/sitemap.xml")).text();
    expect(sm).toContain(`/guides/${SLUG}</loc>`);
  });

  test("slug change → single permanent redirect, canonical updated", async ({ page, request }) => {
    await login(page);
    await page.goto("/admin/articles?q=" + stamp);
    await page.getByRole("link", { name: TITLE }).click();
    await page.locator("#slug").fill(`${SLUG}-v2`);
    await expect(page.getByText("You're changing the URL of a published article.")).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/now permanently redirects/)).toBeVisible({ timeout: 20_000 });

    const old = await request.get(`/guides/${SLUG}`, { maxRedirects: 0 });
    expect([301, 308]).toContain(old.status());
    expect(old.headers()["location"]).toMatch(new RegExp(`/guides/${SLUG}-v2$`));
    const next = await request.get(`/guides/${SLUG}-v2`, { maxRedirects: 0 });
    expect(next.status()).toBe(200); // one hop, no chain
    expect(await next.text()).toContain(`/guides/${SLUG}-v2"`);
  });

  test("unpublish removes it from the public site", async ({ page, request }) => {
    page.on("dialog", (d) => d.accept());
    await login(page);
    await page.goto("/admin/articles?q=" + stamp);
    await page.getByRole("link", { name: TITLE }).click();
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText(/status is now draft/i)).toBeVisible({ timeout: 20_000 });
    expect((await request.get(`/guides/${SLUG}-v2`)).status()).toBe(404);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(SLUG);
  });

  test("revision history shows diffs and restores with confirmation", async ({ page }) => {
    await login(page);
    await page.goto("/admin/articles?q=" + stamp);
    await page.getByRole("link", { name: TITLE }).click();
    await page.getByRole("link", { name: /Revisions/ }).click();
    await expect(page.getByRole("heading", { name: "Revision history" })).toBeVisible();
    await page.getByRole("button", { name: "Restore this version" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Restore" }).click();
    await expect(page).toHaveURL(/\/edit$/);
  });

  test("scheduled publishing runs via cron exactly once", async ({ page, request }) => {
    test.setTimeout(240_000);
    await login(page);
    await page.goto("/admin/articles?q=" + stamp);
    await page.getByRole("link", { name: TITLE }).click();
    // datetime-local has minute precision, so aim two minutes out.
    const soon = new Date(Date.now() + 120_000);
    const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    await page.getByLabel("Schedule publication").fill(local);
    await page.getByRole("button", { name: /^Schedule for/ }).click();
    await expect(page.getByText(/status is now scheduled/i)).toBeVisible({ timeout: 20_000 });

    const unauthorized = await request.post("/api/cron");
    expect(unauthorized.status()).toBe(401);
    await page.waitForTimeout(Math.max(0, soon.getTime() - Date.now()) + 5_000);
    const headers = { Authorization: "Bearer e2e-cron-secret-0123456789" };
    const [a, b] = await Promise.all([request.post("/api/cron", { headers }), request.post("/api/cron", { headers })]);
    const published = [...(await a.json()).published, ...(await b.json()).published];
    expect(published).toHaveLength(1);
    expect((await request.get(`/guides/${SLUG}-v2`)).status()).toBe(200);
  });
});
