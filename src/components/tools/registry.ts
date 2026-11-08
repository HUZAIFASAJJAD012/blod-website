export type ToolMeta = { slug: string; name: string; kind: "Explainer" | "Checklist"; summary: string; description: string };

export const TOOLS: ToolMeta[] = [
  {
    slug: "http-status-explainer",
    name: "HTTP status code explainer",
    kind: "Explainer",
    summary: "Type a status code and get what it means, who usually causes it, and what to check first.",
    description: "Look up any common HTTP status code: plain-English meaning, the usual culprit (browser, app, server, proxy or CDN) and the first diagnostic steps.",
  },
  {
    slug: "dns-change-checklist",
    name: "DNS change checklist",
    kind: "Checklist",
    summary: "Before and after moving nameservers or editing records — so email and SSL keep working.",
    description: "A step-by-step checklist for changing DNS records or nameservers without breaking email, SSL certificates or site verification.",
  },
  {
    slug: "ssl-certificate-checklist",
    name: "SSL/TLS certificate checklist",
    kind: "Checklist",
    summary: "Install, renew and debug certificates: chain, SNI, redirects, mixed content and CDN modes.",
    description: "A practical checklist for installing, renewing and troubleshooting SSL/TLS certificates, including CDN SSL modes and mixed content.",
  },
];

export function getTool(slug: string) {
  return TOOLS.find((t) => t.slug === slug);
}
