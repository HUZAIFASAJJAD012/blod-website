/**
 * /ads.txt generated from the real AdSense publisher ID in the environment.
 * f08c47fec0942fa0 is Google's published TAG certification authority ID.
 * Without a configured ID this returns 404 rather than a fictitious entry.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const pub = process.env.ADSENSE_PUBLISHER_ID;
  if (!pub || !/^ca-pub-\d{10,20}$/.test(pub)) {
    return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const id = pub.replace(/^ca-/, "");
  const extra = (process.env.ADS_TXT_EXTRA_LINES ?? "")
    .split("\\n")
    .map((l) => l.trim())
    .filter((l) => /^[\w.-]+,\s*[\w-]+,\s*(DIRECT|RESELLER)(,\s*\w+)?$/i.test(l));
  const body = [`google.com, ${id}, DIRECT, f08c47fec0942fa0`, ...extra].join("\n") + "\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
