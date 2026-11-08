/** Wordmark: a layered-bracket glyph + name. Pure SVG/CSS, no image request. */
export function Logo({ text = "FixLayer", inverted = false }: { text?: string; inverted?: boolean }) {
  const ink = inverted ? "#ECF0F4" : "#17191E";
  return (
    <span className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
        <rect x="1" y="1" width="26" height="26" rx="6" fill={inverted ? "#1c2530" : "#17191E"} />
        <path d="M9 8.5h10M9 14h7M9 19.5h10" stroke="#F7F6F2" strokeWidth="2" strokeLinecap="round" />
        <circle cx="20" cy="14" r="1.6" fill="#2254C5" />
      </svg>
      <span className="text-[19px] font-semibold tracking-[-0.4px]" style={{ color: ink }}>
        {text}
      </span>
    </span>
  );
}
