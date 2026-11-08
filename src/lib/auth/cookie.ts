/**
 * Session cookie policy. Secure (and the __Host- prefix, which requires Secure)
 * whenever the canonical origin is HTTPS — i.e. every real deployment. Plain-http
 * local production builds (E2E) fall back to a non-prefixed cookie.
 */
export function cookieIsSecure(): boolean {
  return (process.env.SITE_URL ?? "").startsWith("https://");
}

export function sessionCookieName(): string {
  return cookieIsSecure() ? "__Host-fl_session" : "fl_session";
}
