/**
 * /analisis — Análisis profundo de datos de admisiones
 *
 * Sección de data science con:
 * - Embudo detallado por año y nivel
 * - Días promedio entre etapas (velocidad del proceso)
 * - Distribución mensual de citas (estacionalidad)
 * - Análisis por canal (conversión y referidos)
 * - Desempeño por asesor
 * - Estado del proceso (por qué se pierde prospectos)
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FunnelViz } from "@/components/FunnelViz";
import { MiniBarRow } from "@/components/SvgBarChart";
import { ComparativoAnual } from "@/components/ComparativoAnual";
import { formatNumber } from "@/lib/format";
import {
  cumulativeFlagsFromCompletedStages,
  stagesSetFromRows
} from "@/lib/funnelLogic";

export const dynamic = "force-dynamic";

const MESES_ORDEN = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  const diff = b.getTime() - a.getTime();
  return diff >= 0 ? Math.round(diff / (1000 * 60 * 60 * 24)) : null;
}

function avg(arr: number[]): number | null {
  return arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
}

function pct(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 1000) / 10}%` : "0%";
}

async function getAnalisisData() {
  const [prospectos, referidos] = await Promise.all([
    prisma.prospecto.findMany({
      select: {
        id: true,
        anioProceso: true,
        nivel: true,
        canalLlegada: true,
        canalLlegadaOriginal: true,
        referidoNombre: true,
        asesor: true,
        estadoProcesoCat: true,
        mesCita: true,
        citasInformacion: {
          select: { fecha: true },
          orderBy: { fecha: "asc" },
          take: 1
        },
        etapas: {
          select: { etapa: true, fecha: true, completada: true }
        }
      }
    }),
    prisma.prospecto.groupBy({
      by: ["referidoNombre"],
      where: { referidoNombre: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { referidoNombre: "desc" } },
      take: 15
    })
  ]);

  // ── Embudo por año × nivel ────────────────────────────────────────────
  type EmbudoRow = {
    anio: number;
    nivel: string | null;
    total_citas: number;
    inicio_proceso: number;
    pruebas: number;
    observacion: number;
    matricula: number;
    tasa_matricula: number;
  };
  const embudoMap = new Map<string, EmbudoRow>();

  for (const p of prospectos) {
    const key = `${p.anioProceso}|${p.nivel ?? "SIN_NIVEL"}`;
    if (!embudoMap.has(key)) {
      embudoMap.set(key, {
        anio: p.anioProceso,
        nivel: p.nivel,
        total_citas: 0,
        inicio_proceso: 0,
        pruebas: 0,
        observacion: 0,
        matricula: 0,
        tasa_matricula: 0
      });
    }
    const row = embudoMap.get(key)!;
    row.total_citas++;
    const flags = cumulativeFlagsFromCompletedStages(stagesSetFromRows(p.etapas));
    if (flags.inicio) row.inicio_proceso++;
    if (flags.pruebas) row.pruebas++;
    if (flags.observacion) row.observacion++;
    if (flags.matricula) row.matricula++;
  }

  const embudoRows: EmbudoRow[] = [...embudoMap.values()]
    .map((r) => ({
      ...r,
      tasa_matricula: r.total_citas > 0 ? Math.round((r.matricula / r.total_citas) * 1000) / 10 : 0
    }))
    .sort((a, b) => a.anio - b.anio || (a.nivel ?? "").localeCompare(b.nivel ?? ""));

  // ── Días entre etapas ────────────────────────────────────────────────
  type DiasRow = {
    anio: number;
    nivel: string;
    n: number;
    cita_a_inicio: number | null;
    inicio_a_pruebas: number | null;
    pruebas_a_obs: number | null;
    obs_a_matricula: number | null;
    total_cita_a_matricula: number | null;
  };

  const diasMap = new Map<string, {
    cita_a_inicio: number[];
    inicio_a_pruebas: number[];
    pruebas_a_obs: number[];
    obs_a_matricula: number[];
    total: number[];
    anio: number;
    nivel: string;
  }>();

  for (const p of prospectos) {
    const key = `${p.anioProceso}|${p.nivel ?? "SIN_NIVEL"}`;
    if (!diasMap.has(key)) {
      diasMap.set(key, {
        cita_a_inicio: [],
        inicio_a_pruebas: [],
        pruebas_a_obs: [],
        obs_a_matricula: [],
        total: [],
        anio: p.anioProceso,
        nivel: p.nivel ?? "SIN_NIVEL"
      });
    }
    const d = diasMap.get(key)!;
    const fechaCita = p.citasInformacion[0]?.fecha ?? null;
    const etapaFechas = new Map(
      p.etapas.filter((e) => e.completada && e.fecha).map((e) => [e.etapa, e.fecha as Date])
    );
    const inicio = etapaFechas.get("INICIO_PROCESO") ?? null;
    const pruebas = etapaFechas.get("PRUEBAS") ?? null;
    const obs = etapaFechas.get("OBSERVACION") ?? null;
    const matricula = etapaFechas.get("MATRICULA") ?? null;

    const d1 = daysBetween(fechaCita, inicio);
    if (d1 !== null) d.cita_a_inicio.push(d1);
    const d2 = daysBetween(inicio, pruebas);
    if (d2 !== null) d.inicio_a_pruebas.push(d2);
    const d3 = daysBetween(pruebas, obs);
    if (d3 !== null) d.pruebas_a_obs.push(d3);
    const d4 = daysBetween(obs, matricula);
    if (d4 !== null) d.obs_a_matricula.push(d4);
    const d5 = daysBetween(fechaCita, matricula);
    if (d5 !== null) d.total.push(d5);
  }

  const diasRows: DiasRow[] = [...diasMap.values()]
    .map((d) => ({
      anio: d.anio,
      nivel: d.nivel,
      n: d.total.length,
      cita_a_inicio: avg(d.cita_a_inicio),
      inicio_a_pruebas: avg(d.inicio_a_pruebas),
      pruebas_a_obs: avg(d.pruebas_a_obs),
      obs_a_matricula: avg(d.obs_a_matricula),
      total_cita_a_matricula: avg(d.total)
    }))
    .filter((d) => d.n > 0)
    .sort((a, b) => a.anio - b.anio || a.nivel.localeCompare(b.nivel));

  // ── Distribución mensual ─────────────────────────────────────────────
  const mesMap = new Map<string, { total: number; matriculados: number }>();
  for (const p of prospectos) {
    const mes = p.mesCita ?? "Sin mes";
    if (!mesMap.has(mes)) mesMap.set(mes, { total: 0, matriculados: 0 });
    const m = mesMap.get(mes)!;
    m.total++;
    if (p.etapas.some((e) => e.etapa === "MATRICULA" && e.completada)) m.matriculados++;
  }

  const mesRows = MESES_ORDEN
    .filter((mes) => mesMap.has(mes))
    .map((mes) => ({
      mes,
      ...mesMap.get(mes)!
    }));

  // ── Canal de llegada (conversión) ────────────────────────────────────
  const canalMap = new Map<string, { total: number; matriculados: number }>();
  for (const p of prospectos) {
    const canal = p.canalLlegada ?? "Sin canal";
    if (!canalMap.has(canal)) canalMap.set(canal, { total: 0, matriculados: 0 });
    const c = canalMap.get(canal)!;
    c.total++;
    if (p.etapas.some((e) => e.etapa === "MATRICULA" && e.completada)) c.matriculados++;
  }

  const canalRows = [...canalMap.entries()]
    .map(([canal, { total, matriculados }]) => ({
      canal,
      total,
      matriculados,
      tasa: total > 0 ? Math.round((matriculados / total) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.total - a.total);

  // ── Asesores ─────────────────────────────────────────────────────────
  const asesorMap = new Map<string, { total: number; matriculados: number; inicio: number }>();
  for (const p of prospectos) {
    if (!p.asesor) continue;
    if (!asesorMap.has(p.asesor)) asesorMap.set(p.asesor, { total: 0, matriculados: 0, inicio: 0 });
    const a = asesorMap.get(p.asesor)!;
    a.total++;
    if (p.etapas.some((e) => e.etapa === "MATRICULA" && e.completada)) a.matriculados++;
    if (cumulativeFlagsFromCompletedStages(stagesSetFromRows(p.etapas)).inicio) a.inicio++;
  }

  const asesorRows = [...asesorMap.entries()]
    .map(([asesor, d]) => ({
      asesor,
      total: d.total,
      inicio: d.inicio,
      matriculados: d.matriculados,
      tasa_matricula: d.total > 0 ? Math.round((d.matriculados / d.total) * 1000) / 10 : 0,
      tasa_inicio: d.total > 0 ? Math.round((d.inicio / d.total) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.total - a.total);

  // ── Por qué se pierden prospectos ─────────────────────────────────────
  const estadoMap = new Map<string, number>();
  for (const p of prospectos) {
    const estado = p.estadoProcesoCat ?? "pendiente";
    estadoMap.set(estado, (estadoMap.get(estado) ?? 0) + 1);
  }
  const totalPerdidos = prospectos.length - (estadoMap.get("matriculado") ?? 0);
  const estadoRows = [...estadoMap.entries()]
    .sort((a, b) => b[1] - a[1]);

  return {
    prospectos: prospectos.length,
    embudoRows,
    diasRows,
    mesRows,
    canalRows,
    asesorRows,
    estadoRows,
    totalPerdidos,
    referidos: referidos.map((r) => ({ nombre: r.referidoNombre!, count: r._count._all }))
  };
}

function DiasBadge({ dias }: { dias: number | null }) {
  if (dias === null) return <span className="text-slate-300">—</span>;
  const color = dias <= 14 ? "text-emerald-600" : dias <= 30 ? "text-amber-600" : "text-red-600";
  return <span className={`font-semibold ${color}`}>{dias}d</span>;
}

export default async function AnalisisPage() {
  const data = await getAnalisisData();
  const maxMes = Math.max(...data.mesRows.map((m) => m.total), 1);
  const maxCanal = Math.max(...data.canalRows.map((c) => c.total), 1);

  // Embudo global agregado para la visualización principal
  const embudoGlobal = (() => {
    const totales = data.embudoRows.reduce(
      (acc, r) => ({
        total_citas: acc.total_citas + r.total_citas,
        inicio_proceso: acc.inicio_proceso + r.inicio_proceso,
        pruebas: acc.pruebas + r.pruebas,
        observacion: acc.observacion + r.observacion,
        matricula: acc.matricula + r.matricula
      }),
      { total_citas: 0, inicio_proceso: 0, pruebas: 0, observacion: 0, matricula: 0 }
    );
    return [
      { label: "Citas de información", value: totales.total_citas },
      { label: "Inicio del proceso", value: totales.inicio_proceso },
      { label: "Pruebas", value: totales.pruebas },
      { label: "Observación / Pasantía", value: totales.observacion },
      { label: "Matrícula", value: totales.matricula }
    ];
  })();

  const nivelColors: Record<string, string> = {
    PREESCOLAR: "bg-violet-500",
    PRIMARIA: "bg-blue-500",
    BACHILLERATO: "bg-indigo-600"
  };

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-fontan-blue">Análisis de datos</p>
        <h1 className="mt-2 text-3xl font-bold text-fontan-ink">Inteligencia de admisiones</h1>
        <p className="mt-1 text-sm text-slate-500">
          {formatNumber(data.prospectos)} prospectos · Histórico 2023–2026
        </p>
      </section>

      {/* Embudo global + Comparativo anual */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-fontan-ink">Embudo global de conversión</h2>
          <p className="mb-4 text-xs text-slate-500">
            Todos los años y niveles. La tasa entre pasos muestra la retención en cada etapa.
          </p>
          <FunnelViz stages={embudoGlobal} />
          <p className="mt-4 text-xs text-slate-400">
            Tasa total cita → matrícula:{" "}
            <span className="font-semibold text-fontan-ink">
              {pct(embudoGlobal[4].value, embudoGlobal[0].value)}
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-fontan-ink">Comparativo año a año</h2>
          <p className="mb-4 text-xs text-slate-500">
            Evolución del volumen y tasa de conversión por año (todos los niveles combinados).
          </p>
          <ComparativoAnual rows={data.embudoRows} />
        </div>
      </section>

      {/* Embudo por nivel */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-semibold text-fontan-ink">Embudo por nivel educativo</h2>
        <p className="mb-5 text-xs text-slate-500">
          Comparación de la tasa de conversión por nivel para el total histórico.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {(["PREESCOLAR", "PRIMARIA", "BACHILLERATO"] as const).map((nivel) => {
            const nivelData = data.embudoRows.filter((r) => r.nivel === nivel);
            const totales = nivelData.reduce(
              (acc, r) => ({
                total_citas: acc.total_citas + r.total_citas,
                inicio: acc.inicio + r.inicio_proceso,
                pruebas: acc.pruebas + r.pruebas,
                obs: acc.obs + r.observacion,
                mat: acc.mat + r.matricula
              }),
              { total_citas: 0, inicio: 0, pruebas: 0, obs: 0, mat: 0 }
            );
            if (totales.total_citas === 0) return null;
            const stages = [
              { label: "Citas", value: totales.total_citas, color: nivelColors[nivel] },
              { label: "Inicio", value: totales.inicio, color: nivelColors[nivel] },
              { label: "Pruebas", value: totales.pruebas, color: nivelColors[nivel] },
              { label: "Observación", value: totales.obs, color: nivelColors[nivel] },
              { label: "Matrícula", value: totales.mat, color: nivelColors[nivel] }
            ];
            return (
              <div key={nivel}>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">{nivel}</h3>
                <FunnelViz stages={stages} />
                <p className="mt-2 text-xs text-slate-400">
                  Conversión:{" "}
                  <span className="font-semibold text-fontan-ink">
                    {pct(totales.mat, totales.total_citas)}
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Velocidad del proceso (días entre etapas) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-semibold text-fontan-ink">Velocidad del proceso de admisión</h2>
        <p className="mb-4 text-xs text-slate-500">
          Promedio de días entre cada etapa. Verde &lt;14d · Ámbar 14–30d · Rojo &gt;30d.
          Solo incluye prospectos que completaron ambas etapas de cada intervalo.
        </p>
        {data.diasRows.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Sin datos suficientes de fechas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4">Año</th>
                  <th className="py-2 pr-3">Nivel</th>
                  <th className="py-2 pr-3 text-right">n</th>
                  <th className="py-2 pr-3 text-right">Cita → Inicio</th>
                  <th className="py-2 pr-3 text-right">Inicio → Pruebas</th>
                  <th className="py-2 pr-3 text-right">Pruebas → Obs.</th>
                  <th className="py-2 pr-3 text-right">Obs. → Matr.</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.diasRows.map((row) => (
                  <tr key={`${row.anio}|${row.nivel}`}>
                    <td className="py-2.5 pr-4 font-medium text-fontan-ink">{row.anio}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{row.nivel}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-400">{row.n}</td>
                    <td className="py-2.5 pr-3 text-right"><DiasBadge dias={row.cita_a_inicio} /></td>
                    <td className="py-2.5 pr-3 text-right"><DiasBadge dias={row.inicio_a_pruebas} /></td>
                    <td className="py-2.5 pr-3 text-right"><DiasBadge dias={row.pruebas_a_obs} /></td>
                    <td className="py-2.5 pr-3 text-right"><DiasBadge dias={row.obs_a_matricula} /></td>
                    <td className="py-2.5 text-right"><DiasBadge dias={row.total_cita_a_matricula} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Estacionalidad + Canal */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Distribución mensual */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-fontan-ink">Estacionalidad de citas</h2>
          <p className="mb-4 text-xs text-slate-500">
            Volumen de prospectos por mes (histórico). Útil para planear campañas.
          </p>
          <div className="space-y-2.5">
            {data.mesRows.map((m) => (
              <MiniBarRow
                key={m.mes}
                label={m.mes.slice(0, 3)}
                value={m.total}
                max={maxMes}
                secondary={`${m.matriculados} matr.`}
              />
            ))}
          </div>
        </div>

        {/* Canal de llegada */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-fontan-ink">Canal de llegada vs. conversión</h2>
          <p className="mb-4 text-xs text-slate-500">
            Cada canal con su volumen de prospectos y tasa de matrícula.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="py-1.5 pr-3">Canal</th>
                  <th className="py-1.5 pr-3 text-right">Total</th>
                  <th className="py-1.5 pr-3 text-right">Matr.</th>
                  <th className="py-1.5 text-right">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.canalRows.map((c) => (
                  <tr key={c.canal}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-fontan-blue"
                          style={{
                            opacity: maxCanal > 0 ? Math.max(0.2, c.total / maxCanal) : 0.2
                          }}
                        />
                        <span className="text-slate-700">{c.canal}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-600">{c.total}</td>
                    <td className="py-2 pr-3 text-right text-emerald-700 font-medium">{c.matriculados}</td>
                    <td className="py-2 text-right">
                      <span className={`font-semibold ${c.tasa >= 30 ? "text-emerald-600" : c.tasa >= 15 ? "text-amber-600" : "text-slate-500"}`}>
                        {c.tasa}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Asesores + Referidos */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Asesores */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-fontan-ink">Desempeño por asesor</h2>
          <p className="mb-4 text-xs text-slate-500">
            Solo prospectos con asesor asignado. Tasa de conversión = matrículas / total.
          </p>
          {data.asesorRows.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin datos de asesores.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="py-1.5 pr-3">Asesor</th>
                    <th className="py-1.5 pr-3 text-right">Total</th>
                    <th className="py-1.5 pr-3 text-right">Inicio</th>
                    <th className="py-1.5 pr-3 text-right">Matr.</th>
                    <th className="py-1.5 text-right">Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.asesorRows.map((a) => (
                    <tr key={a.asesor}>
                      <td className="py-2.5 pr-3 font-medium text-fontan-ink">{a.asesor}</td>
                      <td className="py-2.5 pr-3 text-right text-slate-600">{a.total}</td>
                      <td className="py-2.5 pr-3 text-right text-slate-500">{a.inicio}</td>
                      <td className="py-2.5 pr-3 text-right text-emerald-700 font-semibold">{a.matriculados}</td>
                      <td className="py-2.5 text-right">
                        <span className={`font-semibold ${a.tasa_matricula >= 30 ? "text-emerald-600" : a.tasa_matricula >= 15 ? "text-amber-600" : "text-slate-500"}`}>
                          {a.tasa_matricula}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top referidos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-fontan-ink">Top fuentes de referidos</h2>
          <p className="mb-4 text-xs text-slate-500">
            Personas o fuentes que más han referido prospectos al colegio.
          </p>
          {data.referidos.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin datos de referidos extraídos.</p>
          ) : (
            <div className="space-y-2.5">
              {data.referidos.slice(0, 12).map((r, i) => (
                <div key={r.nombre} className="flex items-center gap-3">
                  <span className="w-4 text-right text-xs text-slate-400">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700 truncate max-w-[70%]">{r.nombre}</span>
                      <span className="text-slate-500">{r.count} prosp.</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-violet-500"
                        style={{ width: `${Math.round((r.count / data.referidos[0].count) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Por qué se pierden prospectos */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-semibold text-fontan-ink">Razones de pérdida de prospectos</h2>
        <p className="mb-5 text-xs text-slate-500">
          Distribución de estados del proceso. Los estados de color rojo representan pérdidas definitivas.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.estadoRows.map(([estado, count]) => {
            const esPositivo = estado === "matriculado";
            const esNegativo = ["no_admitido", "desiste", "no_continua_costos", "otro_colegio", "no_responde", "necesidades_especiales"].includes(estado);
            const bg = esPositivo ? "bg-emerald-50 border-emerald-200" : esNegativo ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200";
            const textColor = esPositivo ? "text-emerald-700" : esNegativo ? "text-red-700" : "text-slate-700";
            const countColor = esPositivo ? "text-emerald-800" : esNegativo ? "text-red-800" : "text-slate-800";
            return (
              <div key={estado} className={`rounded-xl border p-4 ${bg}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${textColor}`}>{estado.replace(/_/g, " ")}</p>
                <p className={`mt-1 text-2xl font-bold ${countColor}`}>{formatNumber(count)}</p>
                <p className="text-xs text-slate-500">{pct(count, data.prospectos)} del total</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Links de acción */}
      <section className="flex flex-wrap gap-3">
        <Link href="/reportes" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Reportes filtrados →
        </Link>
        <Link href="/seguimientos" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Seguimientos CRM →
        </Link>
        <Link href="/api/reportes/export" className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          Exportar CSV completo
        </Link>
      </section>
    </div>
  );
}
