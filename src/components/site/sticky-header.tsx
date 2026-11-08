"use client";

import { useEffect, useRef, useState } from "react";

/** Header scrolls away normally, then becomes sticky once the reader is past it. */
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const [stuck, setStuck] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { rootMargin: "120px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" style={{ position: "absolute", top: 160, height: 1, width: 1 }} />
      <header className="site-header" data-stuck={stuck ? "true" : "false"}>
        {children}
      </header>
    </>
  );
}
