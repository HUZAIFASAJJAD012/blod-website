import { ImageResponse } from "next/og";

export const alt = "FixLayer — Practical fixes for websites, hosting and modern web apps.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social card (articles without their own OG image inherit it). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F7F6F2", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, background: "#17191E", borderRadius: 12, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 12px", gap: 7 }}>
            <div style={{ height: 5, width: 32, background: "#F7F6F2", borderRadius: 3 }} />
            <div style={{ height: 5, width: 22, background: "#F7F6F2", borderRadius: 3 }} />
            <div style={{ height: 5, width: 32, background: "#F7F6F2", borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#17191E" }}>FixLayer</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, color: "#17191E", letterSpacing: -2, lineHeight: 1.05 }}>Fix the problem. Understand the cause.</div>
          <div style={{ fontSize: 30, color: "#606875" }}>Tested guides for WordPress, hosting, Cloudflare, DNS and Node.js.</div>
        </div>
        <div style={{ display: "flex", height: 8, width: 160, background: "#2254C5", borderRadius: 4 }} />
      </div>
    ),
    size,
  );
}
