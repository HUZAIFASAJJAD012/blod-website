import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: { template: "%s · FixLayer admin", default: "FixLayer admin" },
  robots: NOINDEX,
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#F3F2EE]">{children}</div>;
}
