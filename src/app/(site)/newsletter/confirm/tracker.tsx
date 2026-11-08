"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/utils/analytics-client";

export function ConfirmTracker() {
  useEffect(() => trackEvent("newsletter_confirm"), []);
  return null;
}
