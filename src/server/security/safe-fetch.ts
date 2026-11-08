import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Blocks loopback, private, link-local, CGNAT, multicast and metadata ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]!) : false;
  }
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/**
 * Link-health check for editor-supplied URLs (SSRF-hardened): http(s) only,
 * standard ports, every hop's DNS answer must be public, max 5 redirects, 6s timeout.
 * Note: a DNS-rebinding window between lookup and connect remains; run this from
 * an egress-restricted environment for strong guarantees (documented in SECURITY.md).
 */
export async function checkUrlHealth(rawUrl: string): Promise<{ status: number | null; finalUrl?: string; error?: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { status: null, error: "Invalid URL" };
  }
  for (let hop = 0; hop < 5; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") return { status: null, error: "Unsupported protocol" };
    if (url.port && !["80", "443"].includes(url.port)) return { status: null, error: "Non-standard port blocked" };
    if (url.username || url.password) return { status: null, error: "Credentials in URL blocked" };
    try {
      const addrs = await lookup(url.hostname, { all: true });
      if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) return { status: null, error: "Host resolves to a private address" };
    } catch {
      return { status: null, error: "DNS lookup failed" };
    }
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "FixLayer-LinkCheck/1.0 (+editorial link health)" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url);
        continue;
      }
      if (res.status === 405 || res.status === 403) {
        const g = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(6000), headers: { Range: "bytes=0-0", "User-Agent": "FixLayer-LinkCheck/1.0" } });
        return { status: g.status, finalUrl: url.toString() };
      }
      return { status: res.status, finalUrl: url.toString() };
    } catch (e) {
      return { status: null, error: (e as Error).name === "TimeoutError" ? "Timed out" : "Request failed" };
    }
  }
  return { status: null, error: "Too many redirects" };
}
