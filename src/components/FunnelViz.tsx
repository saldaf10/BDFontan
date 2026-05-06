/**
 * FunnelViz — Visualización de embudo de conversión.
 * Componente de servidor (sin "use client").
 */
type FunnelStage = {
  label: string;
  value: number;
  color?: string;
};

type FunnelVizProps = {
  stages: FunnelStage[];
  title?: string;
};

const COLORS = [
  "bg-fontan-blue",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500"
];

export function FunnelViz({ stages, title }: FunnelVizProps) {
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="space-y-3">
      {title ? <h3 className="text-sm font-semibold text-slate-700">{title}</h3> : null}
      {stages.map((stage, i) => {
        const pct = Math.round((stage.value / max) * 100);
        const convRate = i > 0 && stages[i - 1].value > 0
          ? Math.round((stage.value / stages[i - 1].value) * 1000) / 10
          : null;

        return (
          <div key={stage.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{stage.label}</span>
              <div className="flex items-center gap-3">
                {convRate !== null ? (
                  <span className="text-xs text-slate-400">→ {convRate}%</span>
                ) : null}
                <span className="w-12 text-right font-semibold text-fontan-ink">
                  {stage.value.toLocaleString("es-CO")}
                </span>
              </div>
            </div>
            <div className="h-7 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${stage.color ?? COLORS[i % COLORS.length]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
