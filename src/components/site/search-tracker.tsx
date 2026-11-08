"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/utils/analytics-client";

/** GA4 `search` event without the query text (could contain personal data). */
export function SearchTracker({ resultCount }: { resultCount: number }) {
  useEffect(() => {
    trackEvent("search", { result_count: resultCount });
  }, [resultCount]);
  return null;
}
