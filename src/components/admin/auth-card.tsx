import { Logo } from "@/components/site/logo";

export function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-[12px] border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-8">
          <h1 className="text-[22px] font-semibold tracking-[-0.3px]">{title}</h1>
          <div className="mt-5">{children}</div>
        </div>
        {footer ? <div className="mt-4 text-center text-[14px] text-muted">{footer}</div> : null}
      </div>
    </main>
  );
}
