"use client";

import { useEffect } from "react";

export function NotFoundBeacon() {
  useEffect(() => {
    const body = JSON.stringify({ path: window.location.pathname, referrer: document.referrer || undefined });
    fetch("/api/not-found", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
  }, []);
  return null;
}
