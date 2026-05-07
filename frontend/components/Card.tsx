import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, eyebrow, children, className = "" }: CardProps) {
  return (
    <section className={`overflow-hidden rounded-lg border border-line bg-white p-4 shadow-soft ${className}`}>
      {eyebrow ? <p className="mb-1 text-xs font-semibold text-stone-500">{eyebrow}</p> : null}
      {title ? <h2 className="mb-3 text-lg font-bold text-ink">{title}</h2> : null}
      {children}
    </section>
  );
}
