type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-fontan-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
    </div>
  );
}
