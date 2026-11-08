import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { db } from "@/lib/db";
import { normalizePath } from "@/server/redirects";
import { sessionCookieName } from "@/lib/auth/cookie";

/**
 * Runs before every page request (Node.js runtime):
 *  1. Canonical origin: permanent redirect to SITE_URL's scheme + host (www/non-www, https).
 *  2. Managed redirects from the database (cached per instance for 60s), one hop, 301/308.
 *  3. Security headers, incl. a nonce-based strict CSP on /admin.
 *  4. Optimistic admin gate (real authorization happens in server code).
 */

type Rule = { id: string; to: string; status: number };
// Redirect edits in admin take effect within TTL on every instance (no shared bus needed).
let cache: { at: number; rules: Map<string, Rule> } | null = null;
const TTL = 30_000;

async function redirectRules(): Promise<Map<string, Rule>> {
  if (cache && Date.now() - cache.at < TTL) return cache.rules;
  try {
    const rows = await db.redirect.findMany({ where: { enabled: true }, select: { id: true, fromPath: true, toPathOrUrl: true, httpStatus: true } });
    cache = { at: Date.now(), rules: new Map(rows.map((r) => [r.fromPath, { id: r.id, to: r.toPathOrUrl, status: r.httpStatus }])) };
  } catch {
    cache = { at: Date.now(), rules: cache?.rules ?? new Map() };
  }
  return cache.rules;
}

const THIRD_PARTY = {
  script: [
    "https://pagead2.googlesyndication.com",
    "https://*.googlesyndication.com",
    "https://www.googletagmanager.com",
    "https://*.google.com",
    "https://*.gstatic.com",
    "https://fundingchoicesmessages.google.com",
    "https://*.adtrafficquality.google",
  ],
  connect: [
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
    "https://*.googlesyndication.com",
    "https://*.google.com",
    "https://fundingchoicesmessages.google.com",
    "https://*.adtrafficquality.google",
  ],
  frame: [
    "https://*.googlesyndication.com",
    "https://*.doubleclick.net",
    "https://*.google.com",
    "https://www.youtube-nocookie.com",
    "https://*.adtrafficquality.google",
  ],
};

function cmpOrigin(): string[] {
  try {
    return process.env.CMP_SCRIPT_URL ? [new URL(process.env.CMP_SCRIPT_URL).origin] : [];
  } catch {
    return [];
  }
}

function mediaOrigin(): string[] {
  return process.env.MEDIA_PUBLIC_HOST ? [`https://${process.env.MEDIA_PUBLIC_HOST}`] : [];
}

/**
 * Public pages are ISR-cached HTML, so a per-request nonce is impossible there:
 * we allow 'unsafe-inline' for scripts (needed by Next.js inline bootstrap and
 * Consent Mode defaults) but restrict script origins to an explicit allowlist.
 * Admin pages are always dynamic, so they get a strict nonce + strict-dynamic CSP.
 * Rationale documented in docs/SECURITY.md.
 */
function publicCsp(): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${dev ? "'unsafe-eval' " : ""}${[...THIRD_PARTY.script, ...cmpOrigin()].join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://*.googlesyndication.com https://*.google.com https://*.gstatic.com https://*.doubleclick.net https://www.google-analytics.com https://i.ytimg.com ${mediaOrigin().join(" ")}`,
    "font-src 'self'",
    `connect-src 'self' ${[...THIRD_PARTY.connect, ...cmpOrigin()].join(" ")}${dev ? " ws:" : ""}`,
    `frame-src ${[...THIRD_PARTY.frame, ...cmpOrigin()].join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function adminCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${mediaOrigin().join(" ")}`,
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}${process.env.S3_ENDPOINT ? ` ${new URL(process.env.S3_ENDPOINT).origin}` : ""}${process.env.S3_BUCKET && process.env.S3_REGION ? ` https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com` : ""}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function securityHeaders(res: NextResponse, csp: string) {
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  if (process.env.NODE_ENV === "production") res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return res;
}

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const url = req.nextUrl;
  const prod = process.env.NODE_ENV === "production";
  const isHealthCheck = url.pathname === "/api/health";

  // 1. Canonical origin (production only; local dev uses whatever host it runs on).
  // Railway probes the container through its internal host, so health checks
  // must reach the route directly instead of following the public redirect.
  if (prod && process.env.SITE_URL && !isHealthCheck) {
    const canonical = new URL(process.env.SITE_URL);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
    const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    if (host !== canonical.host || proto !== canonical.protocol.replace(":", "")) {
      const target = new URL(url.pathname + url.search, canonical);
      return NextResponse.redirect(target, 308);
    }
  }

  const isAdmin = url.pathname === "/admin" || url.pathname.startsWith("/admin/");

  // 2. Managed redirects (public paths only).
  if (!isAdmin && !url.pathname.startsWith("/api/")) {
    const rules = await redirectRules();
    const key = normalizePath(url.pathname);
    const rule = rules.get(key);
    if (rule) {
      const dest = /^https?:\/\//.test(rule.to) ? new URL(rule.to) : new URL(rule.to + (url.search || ""), req.url);
      event.waitUntil(
        db.redirect.update({ where: { id: rule.id }, data: { hits: { increment: 1 }, lastHitAt: new Date() } }).catch(() => undefined),
      );
      return NextResponse.redirect(dest, rule.status === 308 ? 308 : 301);
    }
    // Trailing-slash normalisation: one permanent hop to the canonical form.
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      const clean = url.clone();
      clean.pathname = url.pathname.replace(/\/+$/, "");
      return NextResponse.redirect(clean, 308);
    }
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-fl-pathname", url.pathname);
  if (!requestHeaders.get("x-request-id")) requestHeaders.set("x-request-id", crypto.randomUUID());

  if (isAdmin) {
    // 4. Optimistic gate: no session cookie → straight to login (server re-checks everything).
    const hasSession = req.cookies.has(sessionCookieName());
    const open = url.pathname.startsWith("/admin/login") || url.pathname.startsWith("/admin/accept-invite") || url.pathname.startsWith("/admin/reset-password");
    if (!hasSession && !open) {
      const login = new URL("/admin/login", req.url);
      if (url.pathname !== "/admin") login.searchParams.set("next", url.pathname);
      return NextResponse.redirect(login);
    }
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = adminCsp(nonce);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("Cache-Control", "private, no-store");
    return securityHeaders(res, csp);
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (url.pathname.startsWith("/preview")) res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return securityHeaders(res, publicCsp());
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    "/((?!_next/static|_next/image|uploads/|brand-assets/|favicon.ico|icon|apple-icon|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|txt|xml|woff2?)$).*)",
  ],
};
