import { expect, test } from "@playwright/test";

test("robots.txt, sitemap.xml and ads.txt respond correctly", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const txt = await robots.text();
  expect(txt).toMatch(/Disallow: \/admin/);
  expect(txt).toMatch(/Disallow: \/search/);
  expect(txt).toMatch(/Sitemap: .*\/sitemap\.xml/);

  const sm = await request.get("/sitemap.xml");
  expect(sm.status()).toBe(200);
  expect(sm.headers()["content-type"]).toContain("xml");
  const xml = await sm.text();
  expect(xml).not.toContain("/admin");
  expect(xml).not.toContain("/search");
  expect(xml).not.toContain("/preview");
  expect(xml).not.toContain("?page=");

  // No fictitious publisher ID: 404 until a real one is configured.
  expect((await request.get("/ads.txt")).status()).toBe(404);
});

const PAGES = ["/", "/guides", "/about", "/contact", "/editorial-policy", "/corrections-policy", "/privacy-policy", "/terms", "/affiliate-disclosure", "/tools", "/tools/http-status-explainer"];

for (const path of PAGES) {
  test(`metadata on ${path}`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    expect((await page.title()).length).toBeGreaterThan(5);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{20,}/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(path === "/" ? "^http://localhost:\\d+/?$" : `${path}$`));
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  });
}

test("private surfaces are never indexable", async ({ request, page }) => {
  const admin = await request.get("/admin/login");
  expect(admin.headers()["x-robots-tag"]).toContain("noindex");
  await page.goto("/admin/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.goto("/search?q=test");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const preview = await request.get("/preview/not-a-real-token-xxxxxxxxxxxx");
  expect(preview.status()).toBe(404);
  expect(preview.headers()["x-robots-tag"]).toContain("noindex");
});

test("no soft 404s; trailing slash is one permanent hop", async ({ request }) => {
  for (const p of ["/guides/does-not-exist", "/category/does-not-exist", "/tag/does-not-exist", "/authors/nobody", "/random/path", "/guides?page=999", "/guides?page=abc"]) {
    expect((await request.get(p)).status(), p).toBe(404);
  }
  const slash = await request.get("/about/", { maxRedirects: 0 });
  expect(slash.status()).toBe(308);
  expect(slash.headers()["location"]).toMatch(/\/about$/);
});

test("security headers are present", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
  const admin = await request.get("/admin/login");
  expect(admin.headers()["content-security-policy"]).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
});
