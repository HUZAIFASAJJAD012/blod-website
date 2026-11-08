"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Manual AdSense unit. Height is reserved up front to prevent CLS. The push is
 * guarded so React Strict Mode / re-renders never initialise the same <ins> twice.
 */
export function AdSlot({
  publisherId,
  adUnitId,
  label,
  minHeightDesktop,
  minHeightMobile,
}: {
  publisherId: string;
  adUnitId: string;
  label: string;
  minHeightDesktop: number;
  minHeightMobile: number;
}) {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.dataset.adsbygoogleStatus || el.dataset.flPushed) return;
    el.dataset.flPushed = "1";
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ad blockers or not-yet-approved sites: fail silently, layout already reserved */
    }
  }, []);

  return (
    <aside className="ad-slot" aria-label={label}>
      <p className="ad-slot-label">{label}</p>
      <div
        className="ad-reserve"
        style={{ "--ad-h-m": `${minHeightMobile}px`, "--ad-h-d": `${minHeightDesktop}px` } as React.CSSProperties}
      >
        <ins
          ref={ref}
          className="adsbygoogle"
          style={{ display: "block", minHeight: "inherit" }}
          data-ad-client={publisherId}
          data-ad-slot={adUnitId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
