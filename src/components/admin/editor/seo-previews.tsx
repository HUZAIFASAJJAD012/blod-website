"use client";

/** Illustrative previews only — Google and social platforms may rewrite or truncate. */

export function SerpPreview({ title, url, description }: { title: string; url: string; description: string }) {
  return (
    <figure className="rounded-[8px] border border-line bg-white p-4">
      <figcaption className="mono-label mb-2 text-muted">Search result preview (illustrative)</figcaption>
      <p className="truncate text-[13px] text-[#4d5156]">{url}</p>
      <p className="line-clamp-1 text-[19px] leading-snug text-[#1a0dab]">{title || "Untitled"}</p>
      <p className="line-clamp-2 text-[14px] leading-[1.5] text-[#4d5156]">{description || "No description — Google will pick text from the page."}</p>
      <p className="mt-2 text-[12px] text-muted">Google may rewrite titles and snippets. There is no exact character limit; aim for clear and descriptive.</p>
    </figure>
  );
}

export function SocialPreview({ title, description, image, domain }: { title: string; description: string; image?: string | null; domain: string }) {
  return (
    <figure className="overflow-hidden rounded-[8px] border border-line bg-white">
      <figcaption className="mono-label border-b border-line px-3 py-1.5 text-muted">Social card preview (summary_large_image)</figcaption>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview
        <img src={image} alt="" className="aspect-[1.91/1] w-full object-cover" />
      ) : (
        <div className="grid aspect-[1.91/1] place-items-center bg-[#F7F6F2] text-[13px] text-muted">Default site card will be used</div>
      )}
      <div className="px-3 py-2">
        <p className="text-[12px] uppercase text-muted">{domain}</p>
        <p className="line-clamp-1 text-[15px] font-semibold">{title}</p>
        <p className="line-clamp-2 text-[13px] text-muted">{description}</p>
      </div>
    </figure>
  );
}

export function JsonLdPreview({ data, problems }: { data: unknown; problems: string[] }) {
  return (
    <div>
      {problems.length ? (
        <ul className="mb-2 space-y-1 text-[13px] text-warning">
          {problems.map((p) => (
            <li key={p}>⚠ {p}</li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-[13px] text-positive">✓ Required Article properties present.</p>
      )}
      <pre className="max-h-72 overflow-auto rounded-md bg-code p-3 font-mono text-[11.5px] leading-[1.5] text-code-ink">{JSON.stringify(data, null, 2)}</pre>
      <p className="mt-1 text-[12px] text-muted">Validate the live URL with Google&apos;s Rich Results Test after publishing.</p>
    </div>
  );
}
