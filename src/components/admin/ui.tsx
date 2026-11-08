import Link from "next/link";
import type { ArticleStatus } from "@/generated/prisma/enums";

export function AdminPage({ title, description, actions, children }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.5px]">{title}</h1>
          {description ? <p className="mt-1 max-w-[70ch] text-[14.5px] text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </main>
  );
}

export function Panel({ title, children, actions, className = "" }: { title?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[10px] border border-line bg-surface ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

const STATUS_STYLE: Record<ArticleStatus, string> = {
  DRAFT: "bg-[#ecebe6] text-[#3f4550]",
  IN_REVIEW: "bg-[#fdf1c7] text-[#7a5a0c]",
  APPROVED: "bg-accent-soft text-accent",
  SCHEDULED: "bg-[#ece6fb] text-[#4b2fa0]",
  PUBLISHED: "bg-positive-soft text-positive",
  ARCHIVED: "bg-[#f1e3e1] text-danger",
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
  return <span className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[11.5px] ${STATUS_STYLE[status]}`}>{status.replace("_", " ").toLowerCase()}</span>;
}

export function Stat({ label, value, href, hint }: { label: string; value: number | string; href?: string; hint?: string }) {
  const inner = (
    <>
      <p className="mono-label text-muted">{label}</p>
      <p className="mt-1 text-[28px] font-semibold tracking-[-0.5px]">{value}</p>
      {hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-[10px] border border-line bg-surface p-4 no-underline hover:border-ink">
      {inner}
    </Link>
  ) : (
    <div className="rounded-[10px] border border-line bg-surface p-4">{inner}</div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}

export const th = "px-4 py-2.5 text-left text-[12px] font-medium uppercase tracking-wide text-muted";
export const td = "px-4 py-3 align-top text-[14px]";

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger" | "success"; children: React.ReactNode }) {
  const cls = {
    info: "border-accent/30 bg-accent-soft text-[#1d3f8f]",
    warning: "border-warning/30 bg-warning-soft text-[#6f4512]",
    danger: "border-danger/30 bg-danger-soft text-danger",
    success: "border-positive/30 bg-positive-soft text-positive",
  }[tone];
  return <div className={`rounded-md border px-4 py-3 text-[14px] ${cls}`}>{children}</div>;
}
