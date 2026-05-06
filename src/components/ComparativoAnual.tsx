/**
 * ComparativoAnual — Tabla + mini barras para comparar años del embudo.
 * Componente de servidor.
 */
type AnioRow = {
  anio: number;
  nivel: string | null;
  total_citas: number;
  inicio_proceso: number;
  pruebas: number;
  observacion: number;
  matricula: number;
  tasa_matricula: number;
};

type ComparativoAnualProps = {
  rows: AnioRow[];
  nivel?: string | null;
};

function pctColor(pct: number): string {
  if (pct >= 40) return "text-emerald-600 font-semibold";
  if (pct >= 20) return "text-amber-600 font-semibold";
  return "text-slate-500";
}

export function ComparativoAnual({ rows, nivel }: ComparativoAnualProps) {
  const filtered = nivel ? rows.filter((r) => r.nivel === nivel) : rows;

  // Agrupar por año (suma todos los niveles si no se filtra)
  const byAnio = new Map<number, AnioRow>();
  for (const r of filtered) {
    if (byAnio.has(r.anio)) {
      const existing = byAnio.get(r.anio)!;
      existing.total_citas += r.total_citas;
      existing.inicio_proceso += r.inicio_proceso;
      existing.pruebas += r.pruebas;
      existing.observacion += r.observacion;
      existing.matricula += r.matricula;
    } else {
      byAnio.set(r.anio, { ...r });
    }
  }

  const anios = [...byAnio.values()].sort((a, b) => a.anio - b.anio);
  const maxTotal = Math.max(...anios.map((a) => a.total_citas), 1);

  if (anios.length === 0) {
    return <p className="text-sm text-slate-400 italic">Sin datos para el filtro seleccionado.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-4">Año</th>
            <th className="py-2 pr-3">Citas</th>
            <th className="py-2 pr-3">Inicio</th>
            <th className="py-2 pr-3">Pruebas</th>
            <th className="py-2 pr-3">Obs.</th>
            <th className="py-2 pr-3">Matr.</th>
            <th className="py-2">Conv.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {anios.map((row) => {
            const tasaReal = row.total_citas > 0
              ? Math.round((row.matricula / row.total_citas) * 1000) / 10
              : 0;
            const barPct = Math.round((row.total_citas / maxTotal) * 100);

            return (
              <tr key={row.anio} className="group">
                <td className="py-3 pr-4">
                  <div className="font-bold text-fontan-ink">{row.anio}</div>
                  <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-fontan-blue" style={{ width: `${barPct}%` }} />
                  </div>
                </td>
                <td className="py-3 pr-3 font-medium">{row.total_citas.toLocaleString("es-CO")}</td>
                <td className="py-3 pr-3 text-slate-600">{row.inicio_proceso.toLocaleString("es-CO")}</td>
                <td className="py-3 pr-3 text-slate-600">{row.pruebas.toLocaleString("es-CO")}</td>
                <td className="py-3 pr-3 text-slate-600">{row.observacion.toLocaleString("es-CO")}</td>
                <td className="py-3 pr-3 text-emerald-700 font-semibold">{row.matricula.toLocaleString("es-CO")}</td>
                <td className={`py-3 ${pctColor(tasaReal)}`}>{tasaReal}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
