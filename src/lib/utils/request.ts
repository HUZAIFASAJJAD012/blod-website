import "server-only";
import { headers } from "next/headers";
import { hashIdentifier } from "./crypto";

/** Best-effort client IP. Trust only the first hop added by your platform's edge. */
export function ipFromHeaders(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}

export async function requestIpHash(): Promise<string> {
  const h = await headers();
  return hashIdentifier(ipFromHeaders(h));
}

export async function requestUserAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent")?.slice(0, 255) ?? null;
}

/**
 * CSRF defence for cookie-authenticated route handlers. Server Actions already
 * compare Origin vs Host inside Next.js; route handlers must do it themselves.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function requestId(h: Headers): string {
  return h.get("x-request-id") ?? crypto.randomUUID();
}
