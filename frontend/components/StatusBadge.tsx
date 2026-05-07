type StatusBadgeProps = {
  tone?: "green" | "yellow" | "red" | "gray";
  children: React.ReactNode;
};

const toneClass = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
  red: "border-red-200 bg-red-50 text-red-700",
  gray: "border-stone-200 bg-stone-50 text-stone-700"
};

export function StatusBadge({ tone = "gray", children }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
