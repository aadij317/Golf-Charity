export default function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between border-b border-ink-line pb-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-sand">
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl italic text-paper">{title}</h1>
      </div>
      {action}
    </div>
  );
}
