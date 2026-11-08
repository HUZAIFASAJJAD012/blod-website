import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { AdminPage } from "@/components/admin/ui";
import { MediaLibrary } from "@/components/admin/media-library";
import { storageDriver } from "@/server/media/storage";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const missingAlt = sp.filter === "missing-alt";
  const rows = await db.media.findMany({
    where: {
      ...(can(user, "media.manageAny") ? {} : { uploadedById: user.id }),
      ...(q ? { OR: [{ alt: { contains: q, mode: "insensitive" } }, { caption: { contains: q, mode: "insensitive" } }] } : {}),
      ...(missingAlt ? { alt: "" } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 120,
    include: { uploadedBy: { select: { name: true } } },
  });
  return (
    <AdminPage title="Media" description="Every image keeps its alt text, caption, credit and licence. Images in use can't be deleted.">
      <MediaLibrary
        q={q}
        missingAlt={missingAlt}
        canCleanup={can(user, "media.manageAny")}
        presigned={storageDriver() === "s3"}
        items={rows.map((m) => ({
          id: m.id,
          fileUrl: m.fileUrl,
          width: m.width,
          height: m.height,
          alt: m.alt,
          caption: m.caption ?? "",
          copyrightHolder: m.copyrightHolder ?? "",
          license: m.license ?? "",
          sourceUrl: m.sourceUrl ?? "",
          focalX: m.focalX,
          focalY: m.focalY,
          mime: m.mime,
          size: m.size,
          uploadedBy: m.uploadedBy.name,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </AdminPage>
  );
}
