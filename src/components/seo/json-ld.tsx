import { serializeLd } from "@/lib/seo/jsonld";

export function JsonLd({ data }: { data: unknown }) {
  // Content is serialized with </script> breakout protection; data comes from our own builders.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeLd(data) }} />;
}
