type InfoRowProps = {
  label: string;
  value: React.ReactNode;
};

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 py-2 last:border-b-0">
      <span className="shrink-0 text-sm text-stone-500">{label}</span>
      <span className="min-w-0 flex-1 break-words text-right text-sm font-medium leading-6 text-ink">{value}</span>
    </div>
  );
}
