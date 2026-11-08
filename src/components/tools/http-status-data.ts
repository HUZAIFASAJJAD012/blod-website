export type StatusInfo = {
  code: number;
  name: string;
  meaning: string;
  usualCause: "Client" | "Application" | "Web server" | "Proxy / CDN" | "Redirect";
  checks: string[];
};

/** Hand-written reference for the codes site owners actually hit. Sources: RFC 9110 and vendor docs. */
export const STATUS_CODES: StatusInfo[] = [
  { code: 200, name: "OK", meaning: "The request succeeded.", usualCause: "Application", checks: ["If a missing page returns 200, you have a soft 404 — make the app return 404."] },
  { code: 201, name: "Created", meaning: "A resource was created (common for API POSTs).", usualCause: "Application", checks: ["Check the Location header points at the new resource."] },
  { code: 204, name: "No Content", meaning: "Success with no response body.", usualCause: "Application", checks: ["Clients expecting JSON will fail to parse — confirm the API contract."] },
  { code: 301, name: "Moved Permanently", meaning: "The URL has permanently moved; browsers and search engines update to the new location.", usualCause: "Redirect", checks: ["Use for changed slugs and domain moves.", "Keep it to a single hop — avoid chains.", "Browsers cache 301s aggressively; test in a private window."] },
  { code: 302, name: "Found", meaning: "Temporary redirect.", usualCause: "Redirect", checks: ["If the move is permanent, use 301/308 instead.", "Login redirects are a normal use of 302/303."] },
  { code: 304, name: "Not Modified", meaning: "The cached copy is still valid (conditional request).", usualCause: "Web server", checks: ["Normal behaviour. If changes don't show, check ETag/Last-Modified and CDN cache."] },
  { code: 307, name: "Temporary Redirect", meaning: "Temporary redirect that preserves the request method and body.", usualCause: "Redirect", checks: ["Seen with HSTS internal redirects in browsers (Chrome shows 307 for http→https)."] },
  { code: 308, name: "Permanent Redirect", meaning: "Permanent redirect that preserves method and body.", usualCause: "Redirect", checks: ["Equivalent to 301 for SEO purposes; safe for POST endpoints."] },
  { code: 400, name: "Bad Request", meaning: "The server could not understand the request.", usualCause: "Client", checks: ["Oversized cookies or headers are a classic cause — clear cookies for the site.", "Check request body/JSON validity for APIs."] },
  { code: 401, name: "Unauthorized", meaning: "Authentication is required or failed.", usualCause: "Application", checks: ["Check API keys/tokens and their expiry.", "Basic-auth on staging sites returns 401 to crawlers."] },
  { code: 403, name: "Forbidden", meaning: "The server understood but refuses the request.", usualCause: "Web server", checks: ["File permissions (e.g. 644 files / 755 directories on typical Linux hosting).", "WAF / security plugin / CDN firewall rules.", "Missing index file with directory listing disabled."] },
  { code: 404, name: "Not Found", meaning: "No resource exists at this URL.", usualCause: "Application", checks: ["WordPress: re-save permalinks to regenerate rewrite rules.", "Check for a changed slug that needs a 301.", "Nginx: confirm try_files falls through to index.php."] },
  { code: 405, name: "Method Not Allowed", meaning: "The URL exists but not for this HTTP method.", usualCause: "Application", checks: ["Webhook endpoints often only accept POST.", "Check CDN/WAF rules that block methods."] },
  { code: 408, name: "Request Timeout", meaning: "The client took too long to send the request.", usualCause: "Client", checks: ["Slow uploads on poor connections; check client_body_timeout / proxy timeouts."] },
  { code: 410, name: "Gone", meaning: "The resource was deliberately removed and won't return.", usualCause: "Application", checks: ["Use for content you've intentionally deleted; search engines drop it faster than 404."] },
  { code: 413, name: "Content Too Large", meaning: "The request body exceeds the server's limit.", usualCause: "Web server", checks: ["Nginx: client_max_body_size.", "PHP: upload_max_filesize and post_max_size.", "CDN upload limits on your plan."] },
  { code: 419, name: "Page Expired (non-standard)", meaning: "Laravel-specific: CSRF token mismatch or expired session.", usualCause: "Application", checks: ["Check session cookie domain and SameSite settings.", "Cached pages serving stale CSRF tokens."] },
  { code: 429, name: "Too Many Requests", meaning: "Rate limit exceeded.", usualCause: "Proxy / CDN", checks: ["Read the Retry-After header.", "Check CDN rate-limiting rules and API quotas.", "Bots hammering wp-login.php or xmlrpc.php."] },
  { code: 500, name: "Internal Server Error", meaning: "The application crashed or the server hit an unhandled error.", usualCause: "Application", checks: ["Read the error log first (PHP error log, wp-content/debug.log, app logs).", "Recent plugin/theme/deploy change? Roll it back.", "Broken .htaccess directives on Apache.", "PHP memory_limit exhausted."] },
  { code: 501, name: "Not Implemented", meaning: "The server does not support the functionality required.", usualCause: "Web server", checks: ["Unusual HTTP method or a proxy that doesn't support it."] },
  { code: 502, name: "Bad Gateway", meaning: "A proxy got an invalid response (or none) from the upstream server.", usualCause: "Proxy / CDN", checks: ["Is the upstream running? (php-fpm, Node process, container).", "Socket/port mismatch between proxy and upstream.", "Upstream crashed on this request — check its logs.", "Response headers too large for proxy buffers."] },
  { code: 503, name: "Service Unavailable", meaning: "The server is overloaded or in maintenance.", usualCause: "Web server", checks: ["WordPress: a leftover .maintenance file after a failed update.", "Worker pool exhausted (pm.max_children, container limits).", "Planned maintenance should send Retry-After."] },
  { code: 504, name: "Gateway Timeout", meaning: "The proxy waited too long for the upstream.", usualCause: "Proxy / CDN", checks: ["Slow database queries or external API calls.", "Proxy read timeouts (proxy_read_timeout, fastcgi_read_timeout).", "CDN timeouts are fixed per plan — move long jobs to a queue."] },
  { code: 520, name: "Web Server Returned an Unknown Error (Cloudflare)", meaning: "Cloudflare-specific: the origin returned something empty or unexpected.", usualCause: "Proxy / CDN", checks: ["Origin crashed or reset the connection.", "Headers over Cloudflare's size limit.", "Origin firewall blocking Cloudflare IP ranges."] },
  { code: 521, name: "Web Server Is Down (Cloudflare)", meaning: "Cloudflare-specific: the origin refused the connection.", usualCause: "Proxy / CDN", checks: ["Is the web server listening on 80/443?", "Allow Cloudflare IP ranges in the origin firewall."] },
  { code: 522, name: "Connection Timed Out (Cloudflare)", meaning: "Cloudflare-specific: TCP connection to the origin timed out.", usualCause: "Proxy / CDN", checks: ["Wrong origin IP in the DNS record.", "Origin overloaded or firewall dropping packets."] },
  { code: 525, name: "SSL Handshake Failed (Cloudflare)", meaning: "Cloudflare-specific: TLS handshake with the origin failed.", usualCause: "Proxy / CDN", checks: ["Origin has no valid certificate on 443 while SSL mode is Full/Full (strict).", "SNI or cipher mismatch on the origin."] },
  { code: 526, name: "Invalid SSL Certificate (Cloudflare)", meaning: "Cloudflare-specific: origin certificate is invalid under Full (strict).", usualCause: "Proxy / CDN", checks: ["Expired, self-signed or wrong-hostname origin certificate.", "Install a valid public or Cloudflare Origin CA certificate."] },
];
