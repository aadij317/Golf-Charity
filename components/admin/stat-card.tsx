export default function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="panel p-5">
      <p className="mb-1 text-xs uppercase tracking-wide text-paper/50">{label}</p>
      <p className="font-display text-3xl italic text-paper">{value}</p>
      {sub && <p className="mt-1 text-xs text-paper/40">{sub}</p>}
    </div>
  );
}
