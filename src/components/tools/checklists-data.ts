import type { ChecklistSection } from "./checklist";

export const DNS_CHECKLIST: ChecklistSection[] = [
  {
    title: "Before you change anything",
    items: [
      { id: "export", text: "Export or screenshot the full current zone (every record, not just A/CNAME).", detail: "Include MX, TXT (SPF, DKIM, DMARC, verification), CAA and SRV records — these are the ones that get lost." },
      { id: "ttl", text: "Lower TTLs on records you'll change to 300 seconds, at least one old-TTL period in advance.", detail: "Resolvers keep the old answer for up to the previous TTL." },
      { id: "mail", text: "Identify who handles email (MX target) and note DKIM selectors.", detail: "Search the old zone for TXT records containing v=spf1 and v=DKIM1." },
      { id: "dnssec", text: "Check whether DNSSEC is enabled at the registrar.", detail: "Moving nameservers with an old DS record still published will make the domain fail to resolve for validating resolvers. Remove the DS record first, or migrate keys." },
    ],
  },
  {
    title: "Making the change",
    items: [
      { id: "recreate", text: "Recreate every record at the new DNS provider before switching nameservers." },
      { id: "compare", text: "Query the new provider's nameservers directly and compare answers to the old zone.", detail: "dig @new-ns1.example.net example.com MX +short" },
      { id: "ns", text: "Update nameservers at the registrar (not at the old DNS host)." },
      { id: "proxy", text: "If using a proxying CDN, decide per record whether it should be proxied.", detail: "Mail, FTP and SSH hostnames should usually be DNS-only." },
    ],
  },
  {
    title: "After the change",
    items: [
      { id: "public", text: "Check answers from several public resolvers (1.1.1.1, 8.8.8.8, 9.9.9.9)." },
      { id: "mailtest", text: "Send and receive a test email; check SPF/DKIM/DMARC pass in the received headers." },
      { id: "ssl", text: "Confirm the SSL certificate still validates and auto-renewal can complete (HTTP-01 or DNS-01)." },
      { id: "verify", text: "Re-check site verification records (Search Console, etc.) are present." },
      { id: "ttlback", text: "Raise TTLs back to normal values once stable (e.g. 3600)." },
    ],
  },
];

export const SSL_CHECKLIST: ChecklistSection[] = [
  {
    title: "Certificate basics",
    items: [
      { id: "names", text: "Certificate covers every hostname you serve (apex and www).", detail: "openssl x509 -noout -ext subjectAltName" },
      { id: "expiry", text: "Expiry date is known and renewal is automated and monitored." },
      { id: "chain", text: "Server sends the full intermediate chain, not just the leaf certificate.", detail: "Missing intermediates work in some browsers and fail in others and in API clients." },
      { id: "sni", text: "Test with SNI: openssl s_client -connect host:443 -servername host." },
    ],
  },
  {
    title: "Redirects & HTTPS everywhere",
    items: [
      { id: "onehop", text: "http:// redirects to https:// in a single hop with 301/308." },
      { id: "canonical", text: "One canonical host (www or apex) — the other redirects to it." },
      { id: "loop", text: "Behind a CDN or load balancer, the app trusts X-Forwarded-Proto so it doesn't redirect HTTPS requests to HTTPS forever." },
      { id: "cdnmode", text: "CDN SSL mode matches the origin: use end-to-end encryption with a valid origin certificate.", detail: "A 'flexible' mode plus an origin that forces HTTPS is a classic redirect loop." },
    ],
  },
  {
    title: "Page-level checks",
    items: [
      { id: "mixed", text: "No mixed content: images, scripts and CSS all load over https.", detail: "Check the browser console; search the database for hard-coded http:// URLs." },
      { id: "hsts", text: "Only enable HSTS (and preload) once every subdomain works over HTTPS." },
      { id: "caa", text: "If you use CAA records, they allow the CA that issues your certificates." },
    ],
  },
];
