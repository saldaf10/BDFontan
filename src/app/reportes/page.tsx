/**
 * /reportes — Reportes filtrados del embudo de admisiones
 *
 * Filtros: año, nivel, asesor, canal, estado
 * Vistas: embudo filtrado, conversión por canal, asesor, estado
 * Exportación a CSV
 */
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { inputClass } from "@/components/FormField";
import { ESTADOS_PROCESO, NIVELES } from "@/lib/catalogs";
import { FunnelViz } from "@/components/FunnelViz";
import { ComparativoAnual } from "@/components/ComparativoAnual";
import {
  aggregateCumulativeByGroupKey,
  cumulativeFlagsFromCompletedStages,
  nivelKey,
  stagesSetFromRows
} from "@/lib/funnelLogic";

export const dynamic = "force-dynamic";

type ReportesPageProps = {
  searchParams: Promise<{
    anio?: string;
    nivel?: string;
    asesor?: string;
    estado?: string;
    canal?: string;
  }>;
};

type ProspectoReporte = Awaited<ReturnType<typeof getProspectosReporte>>[number];

async function getProspectosReporte(where: Prisma.ProspectoWhereInput) {
  return prisma.prospecto.findMany({
    where,
    select: {
      id: true,
      anioProceso: true,
      nivel: true,
      asesor: true,
      canalLlegada: true,
      estadoProcesoCat: true,
      mesCita: true,
      etapas: {
        select: { etapa: true, completada: true }
      }
    },
    take: 5000
  });
}

function embudoCumulativeCounts(prospectos: ProspectoReporte[]) {
  let inicio = 0;
  let pruebas = 0;
  let observacion = 0;
  let matricula = 0;
  for (const p of prospectos) {
    const f = cumulativeFlagsFromCompletedStages(stagesSetFromRows(p.etapas));
    if (f.inicio) inicio++;
    if (f.pruebas) pruebas++;
    if (f.observacion) observacion++;
    if (f.matricula) matricula++;
  }
  return { inicio, pruebas, observacion, matricula };
}

function groupByField(
  prospectos: ProspectoReporte[],
  field: "canalLlegada" | "asesor" | "estadoProcesoCat" | "nivel"
) {
  const groups = new Map<string, { total: number; matriculados: number }>();
  for (const p of prospectos) {
    const key = p[field] ?? "Sin dato";
    const cur = groups.get(key) ?? { total: 0, matriculados: 0 };
    cur.total++;
    if (p.etapas.some((e) => e.etapa === "MATRICULA" && e.completada)) cur.matriculados++;
    groups.set(key, cur);
  }
  return [...groups.entries()]
    .map(([label, v]) => ({
      label,
      total: v.total,
      matriculados: v.matriculados,
      conversion: v.total > 0 ? Math.round((v.matriculados / v.total) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.total - a.total);
}

function buildQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  return q.toString();
}

async function buildComparativoRows() {
  const totales = await prisma.prospecto.groupBy({
    by: ["anioProceso", "nivel"],
    _count: { _all: true },
    orderBy: [{ anioProceso: "asc" }]
  });
  const etapas = await prisma.etapaProceso.findMany({
    where: { completada: true },
    select: {
      etapa: true,
      idProspecto: true,
      prospecto: { select: { anioProceso: true, nivel: true } }
    }
  });
  const eMap = aggregateCumulativeByGroupKey(
    etapas.map((e) => ({
      idProspecto: e.idProspecto,
      etapa: e.etapa,
      groupKey: `${e.prospecto.anioProceso}|${nivelKey(e.prospecto.nivel)}`
    }))
  );
  return totales.map((row) => {
    const k = `${row.anioProceso}|${nivelKey(row.nivel)}`;
    const e = eMap.get(k) ?? { inicio: 0, pruebas: 0, observacion: 0, matricula: 0 };
    return {
      anio: row.anioProceso,
      nivel: row.nivel,
      total_citas: row._count._all,
      inicio_proceso: e.inicio,
      pruebas: e.pruebas,
      observacion: e.observacion,
      matricula: e.matricula,
      tasa_matricula: row._count._all > 0 ? Math.round((e.matricula / row._count._all) * 1000) / 10 : 0
    };
  });
}

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  const params = await searchParams;
  const anio = params.anio ? Number.parseInt(params.anio, 10) : undefined;

  const where: Prisma.ProspectoWhereInput = {
    ...(anio ? { anioProceso: anio } : {}),
    ...(params.nivel ? { nivel: params.nivel } : {}),
    ...(params.asesor
      ? { asesor: { contains: params.asesor, mode: "insensitive" } }
      : {}),
    ...(params.estado ? { estadoProcesoCat: params.estado } : {}),
    ...(params.canal ? { canalLlegada: params.canal } : {})
  };

  const hayFiltro = Boolean(anio || params.nivel || params.asesor || params.estado || params.canal);

  const [prospectos, canales, comparativoRows] = await Promise.all([
    getProspectosReporte(where),
    prisma.prospecto.findMany({
      distinct: ["canalLlegada"],
      where: { canalLlegada: { not: null } },
      select: { canalLlegada: true },
      orderBy: { canalLlegada: "asc" }
    }),
    buildComparativoRows()
  ]);

  const total = prospectos.length;
  const cum = embudoCumulativeCounts(prospectos);
  const inicio = cum.inicio;
  const pruebas = cum.pruebas;
  const observacion = cum.observacion;
  const matricula = cum.matricula;
  const query = buildQuery(params);

  const byCanal = groupByField(prospectos, "canalLlegada").slice(0, 15);
  const byAsesor = groupByField(prospectos, "asesor").slice(0, 10);
  const byEstado = groupByField(prospectos, "estadoProcesoCat").slice(0, 15);
  const byNivel = groupByField(prospectos, "nivel");

  const embudoStages = [
    { label: "Citas de información", value: total },
    { label: "Inicio del proceso", value: inicio },
    { label: "Pruebas", value: pruebas },
    { label: "Observación", value: observacion },
    { label: "Matrícula", value: matricula }
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-fontan-blue">Reportes</p>
          <h1 className="mt-1 text-2xl font-bold text-fontan-ink">Análisis filtrado</h1>
          <p className="mt-1 text-sm text-slate-500">
            Crea cortes por año, nivel, canal, asesor o estado. Exporta los resultados en CSV.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/analisis"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Análisis completo
          </Link>
          <Link
            href={`/api/reportes/export${query ? `?${query}` : ""}`}
            className="rounded-full bg-fontan-green px-4 py-2 text-sm font-semibold text-white"
          >
            Exportar CSV
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6">
        <input name="anio" defaultValue={params.anio} placeholder="Año" className={inputClass} />
        <select name="nivel" defaultValue={params.nivel ?? ""} className={inputClass}>
          <option value="">Todos los niveles</option>
          {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <input name="asesor" defaultValue={params.asesor} placeholder="Asesor" className={inputClass} />
        <select name="estado" defaultValue={params.estado ?? ""} className={inputClass}>
          <option value="">Todos los estados</option>
          {ESTADOS_PROCESO.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select name="canal" defaultValue={params.canal ?? ""} className={inputClass}>
          <option value="">Todos los canales</option>
          {canales.map((c) => (
            <option key={c.canalLlegada} value={c.canalLlegada ?? ""}>{c.canalLlegada}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button className="flex-1 rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white">
            Aplicar
          </button>
          <Link href="/reportes" className="rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600">
            ✕
          </Link>
        </div>
      </form>

      {/* Embudo visual + comparativo */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-fontan-ink">
            Embudo de conversión
            {hayFiltro ? " (filtrado)" : " (global)"}
          </h2>
          <p className="mb-4 text-xs text-slate-400">
            {formatNumber(total)} prospectos en el corte actual
          </p>
          {total === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin datos para los filtros seleccionados.</p>
          ) : (
            <FunnelViz stages={embudoStages} />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-fontan-ink">Comparativo histórico</h2>
          <p className="mb-4 text-xs text-slate-400">Datos totales sin filtro de año</p>
          <ComparativoAnual rows={comparativoRows} nivel={params.nivel} />
        </div>
      </section>

      {/* Tablas de conversión */}
      <section className="grid gap-6 lg:grid-cols-3">
        <ReportTable title="Conversión por canal" rows={byCanal} />
        <ReportTable title="Conversión por asesor" rows={byAsesor} />
        <ReportTable title="Estados del proceso" rows={byEstado} />
      </section>

      {/* Por nivel */}
      {byNivel.length > 1 && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-fontan-ink">Conversión por nivel</h2>
          </div>
          <div className="grid divide-x divide-slate-100 md:grid-cols-3">
            {byNivel.map((row) => (
              <div key={row.label} className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                <p className="mt-2 text-3xl font-bold text-fontan-ink">{formatNumber(row.total)}</p>
                <p className="text-sm text-slate-500">
                  {formatNumber(row.matriculados)} matric. ·{" "}
                  <span className="font-semibold text-fontan-ink">{row.conversion}%</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ReportTable({
  title,
  rows
}: {
  title: string;
  rows: Array<{ label: string; total: number; matriculados: number; conversion: number }>;
}) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h2 className="font-semibold text-fontan-ink">{title}</h2>
      </div>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">Grupo</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Matr.</th>
            <th className="px-4 py-3 text-right">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const barPct = Math.round((row.total / max) * 100);
            return (
              <tr key={row.label} className="group">
                <td className="px-4 py-3">
                  <div className="text-slate-700">{row.label}</div>
                  <div className="mt-1 h-1 w-full rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-fontan-blue opacity-40" style={{ width: `${barPct}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-600">{formatNumber(row.total)}</td>
                <td className="px-4 py-3 text-right text-emerald-700 font-semibold">{formatNumber(row.matriculados)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-bold ${row.conversion >= 30 ? "text-emerald-600" : row.conversion >= 15 ? "text-amber-600" : "text-slate-500"}`}>
                    {row.conversion}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
