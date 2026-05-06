/**
 * SvgBarChart — Gráfico de barras verticales renderizado en SVG.
 * Componente de servidor (sin "use client").
 */
type BarData = {
  label: string;
  value: number;
  color?: string;
};

type SvgBarChartProps = {
  data: BarData[];
  height?: number;
  showValues?: boolean;
  maxValue?: number;
};

const DEFAULT_COLORS = [
  "#1d4ed8", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e"
];

export function SvgBarChart({ data, height = 160, showValues = true, maxValue }: SvgBarChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 italic">Sin datos</p>;
  }

  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;
  const padding = barWidth * 0.2;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 100 ${height}`}
        className="w-full"
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
        role="img"
        aria-label="Gráfico de barras"
      >
        {data.map((item, i) => {
          const barH = Math.max((item.value / max) * (height - 30), 2);
          const x = i * barWidth + padding;
          const w = barWidth - padding * 2;
          const y = height - barH - 20;
          const color = item.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];

          return (
            <g key={item.label}>
              <rect x={x} y={y} width={w} height={barH} fill={color} rx={1} />
              {showValues ? (
                <text
                  x={x + w / 2}
                  y={y - 2}
                  textAnchor="middle"
                  fontSize={5}
                  fill="#475569"
                >
                  {item.value}
                </text>
              ) : null}
              <text
                x={x + w / 2}
                y={height - 4}
                textAnchor="middle"
                fontSize={4.5}
                fill="#64748b"
              >
                {item.label.length > 6 ? `${item.label.slice(0, 6)}…` : item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * MiniBarRow — Una fila de barra horizontal para tablas de conversión.
 */
type MiniBarRowProps = {
  label: string;
  value: number;
  max: number;
  secondary?: string;
  color?: string;
};

export function MiniBarRow({ label, value, max, secondary, color = "bg-fontan-blue" }: MiniBarRowProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-700 font-medium truncate max-w-[60%]">{label}</span>
        <span className="text-slate-500">
          {value.toLocaleString("es-CO")}
          {secondary ? ` · ${secondary}` : ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
