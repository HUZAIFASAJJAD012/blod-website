import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { rateLimit } from "@/server/security/rate-limit";
import { analyzeRedirect, upsertRedirect } from "@/server/redirects";
import { subscribeNewsletter, submitContact } from "@/server/leads/actions";
import { getAdsRuntime } from "@/lib/ads/config";
import { GET as adsTxt } from "@/app/ads.txt/route";

describe("rate limiting", () => {
  it("blocks after the limit within the window", async () => {
    const key = `t:${Date.now()}`;
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await rateLimit(key, 5, 60)).ok);
    expect(results).toEqual([true, true, true, true, true, false]);
  });
});

describe("redirect safety", () => {
  it("detects loops", async () => {
    const base = `/loop-${Date.now()}`;
    await upsertRedirect({ fromPath: `${base}-a`, to: `${base}-b`, reason: "t" });
    const r = await analyzeRedirect(`${base}-b`, `${base}-a`);
    expect(r.ok).toBe(false);
    await expect(upsertRedirect({ fromPath: `${base}-b`, to: `${base}-a`, reason: "t" })).rejects.toThrow(/loop/);
    await expect(upsertRedirect({ fromPath: `${base}-x`, to: `${base}-x`, reason: "t" })).rejects.toThrow(/itself/);
  });
});

describe("newsletter double opt-in", () => {
  it("stores a pending subscription and never confirms without the token", async () => {
    const email = `nl-${Date.now()}@test.local`;
    const fd = new FormData();
    fd.set("email", email);
    fd.set("consent", "yes");
    const res = await subscribeNewsletter({ status: "idle" }, fd);
    expect(res.status).toBe("success");
    const sub = await db.newsletterSubscription.findUniqueOrThrow({ where: { email } });
    expect(sub.status).toBe("PENDING");
    expect(sub.confirmTokenHash).toBeTruthy();
    expect(await db.emailOutbox.count({ where: { to: email, kind: "newsletter_confirm" } })).toBe(1);
  });
  it("requires consent and silently drops honeypot bots", async () => {
    const fd = new FormData();
    fd.set("email", "a@test.local");
    expect((await subscribeNewsletter({ status: "idle" }, fd)).status).toBe("error");
    const bot = new FormData();
    bot.set("email", "bot@test.local");
    bot.set("consent", "yes");
    bot.set("website", "http://spam.example");
    expect((await subscribeNewsletter({ status: "idle" }, bot)).status).toBe("success");
    expect(await db.newsletterSubscription.findUnique({ where: { email: "bot@test.local" } })).toBeNull();
  });
});

describe("contact form", () => {
  it("rejects invalid payloads and flags obvious spam", async () => {
    const bad = new FormData();
    bad.set("name", "x");
    bad.set("email", "not-an-email");
    expect((await submitContact({ status: "idle" }, bad)).status).toBe("error");

    const spam = new FormData();
    Object.entries({ name: "Spammer", email: "s@test.local", subject: "Great offer", message: "Buy casino seo backlinks now http://a http://b http://c http://d", consent: "yes" }).forEach(([k, v]) => spam.set(k, v));
    expect((await submitContact({ status: "idle" }, spam)).status).toBe("success");
    expect((await db.contactSubmission.findFirstOrThrow({ where: { email: "s@test.local" } })).status).toBe("SPAM");
  });
});

describe("ads are off by default", () => {
  it("has no runtime and no ads.txt without a real publisher ID", async () => {
    delete process.env.ADSENSE_PUBLISHER_ID;
    expect((await getAdsRuntime()).enabled).toBe(false);
    expect(adsTxt().status).toBe(404);
  });
  it("stays off with an ID until approval and CMP are confirmed", async () => {
    process.env.ADSENSE_PUBLISHER_ID = "ca-pub-1234567890123456";
    const r = await getAdsRuntime();
    expect(r.enabled).toBe(false);
    const txt = adsTxt();
    expect(txt.status).toBe(200);
    expect(await txt.text()).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
    delete process.env.ADSENSE_PUBLISHER_ID;
  });
});
