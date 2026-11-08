const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return dateFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function isoDate(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  return (typeof d === "string" ? new Date(d) : d).toISOString();
}

export const ARTICLE_TYPE_LABEL: Record<string, string> = {
  TROUBLESHOOTING: "Troubleshooting",
  TUTORIAL: "Tutorial",
  COMPARISON: "Comparison",
  CHECKLIST: "Checklist",
  OPINION: "Opinion",
  NEWS: "News",
};

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
