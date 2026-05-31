"use client";

import type { ReactNode } from "react";
import { ThemeNavPicker } from "./SiteThemeProvider";

type ShellProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function Shell({ eyebrow, title, subtitle, children }: ShellProps) {
  return (
    <main className="theme-shell-page min-h-screen w-full px-4 pb-10 pt-5">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <a className="text-sm font-bold text-emerald-700" href="/">作品首页</a>
          <ThemeNavPicker compact />
        </div>
        <header className="mb-5">
          {eyebrow ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{eyebrow}</p>
          ) : null}
          <h1 className="text-2xl font-bold leading-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-stone-600">{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </main>
  );
}
