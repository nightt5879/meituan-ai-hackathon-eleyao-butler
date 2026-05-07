import type { ReactNode } from "react";

type ShellProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function Shell({ eyebrow, title, subtitle, children }: ShellProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] px-4 pb-10 pt-5">
      <header className="mb-5">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-bold leading-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm leading-6 text-stone-600">{subtitle}</p> : null}
      </header>
      {children}
    </main>
  );
}
