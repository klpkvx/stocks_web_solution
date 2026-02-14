export default function StatCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-2xl px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
