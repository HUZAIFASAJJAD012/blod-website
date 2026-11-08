import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: 64, height: 64, background: "#17191E", borderRadius: 14, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 14px", gap: 8 }}>
        <div style={{ height: 5, width: 36, background: "#F7F6F2", borderRadius: 3 }} />
        <div style={{ height: 5, width: 24, background: "#F7F6F2", borderRadius: 3 }} />
        <div style={{ height: 5, width: 36, background: "#F7F6F2", borderRadius: 3 }} />
      </div>
    ),
    size,
  );
}
