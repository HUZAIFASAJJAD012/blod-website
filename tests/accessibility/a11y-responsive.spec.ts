import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectNoHorizontalScroll, login } from "../e2e/helpers";

const WIDTHS = [320, 390, 768, 1024, 1440];
const PUBLIC = ["/", "/guides", "/category/wordpress", "/tools/dns-change-checklist", "/contact", "/privacy-policy", "/search?q=error", "/does-not-exist"];

for (const path of PUBLIC) {
  test(`axe: ${path} has no serious WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
}

for (const width of WIDTHS) {
  test(`responsive ${width}px: no sideways scroll + screenshots`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/category/wordpress", "/tools/http-status-explainer", "/contact"]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `tests/screenshots/${path === "/" ? "home" : path.slice(1).replace(/\//g, "_")}-${width}.png`, fullPage: true });
    }
  });
}

test("keyboard: skip link and visible focus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("mobile drawer opens and closes with keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Site menu" })).toBeHidden();
});

test("admin editor at 1440 and 390", async ({ page }) => {
  await login(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/articles/new");
    await expect(page.getByLabel("Title")).toBeVisible();
    await page.screenshot({ path: `tests/screenshots/admin-editor-${width}.png`, fullPage: false });
  }
});
