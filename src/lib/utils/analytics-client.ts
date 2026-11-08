"use client";

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

/** Fire-and-forget GA4 event. Never pass emails, names or free-text form content. */
export function trackEvent(name: "search" | "contact_submit" | "newsletter_signup" | "newsletter_confirm" | "affiliate_click", params: Record<string, string | number> = {}) {
  if (typeof window === "undefined") return;
  (window as GtagWindow).gtag?.("event", name, params);
}
