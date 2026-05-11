import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { FunnelViz } from "@/components/FunnelViz";
import { MiniBarRow } from "@/components/SvgBarChart";
import { ComparativoAnual } from "@/components/ComparativoAnual";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import {
  aggregateGlobalCumulative,
  aggregateCumulativeByGroupKey,
  nivelKey
} from "@/lib/funnelLogic";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const [
    totalProspectos,
    totalEstudiantes,
    totalEventos,
    matriculadosEtapa,
    prospectosPorAnio,
    canalesTop,
    prospectos2026Activos,
    seguimientos2026
  ] = await Promise.all([
    prisma.prospecto.count(),
    prisma.estudiante.count(),
    prisma.eventoInstitucional.count(),
    prisma.etapaProceso.count({ where: { etapa: "MATRICULA", completada: true } }),

    // Prospectos por año (últimos 4 años)
    prisma.prospecto.groupBy({
      by: ["anioProceso"],
      _count: { _all: true },
      orderBy: { anioProceso: "asc" },
      having: { anioProceso: { _min: { gte: 2023 } } }
    }),

    // Top canales con conversión
    prisma.prospecto.groupBy({
      by: ["canalLlegada"],
      where: { canalLlegada: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { canalLlegada: "desc" } },
      take: 8
    }),

    // Prospectos 2026 activos (para CRM pendientes)
    prisma.prospecto.count({
      where: {
        anioProceso: 2026,
        estadoProcesoCat: {
          notIn: ["matriculado", "no_admitido", "desiste", "no_continua_costos", "otro_colegio"]
        }
      }
    }),

    // Prospectos 2026 con seguimiento reciente (últimos 14 días)
    prisma.seguimiento.count({
      where: {
        fecha: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        prospecto: { anioProceso: 2026 }
      }
    })
  ]);

  const etapasFilas = await prisma.etapaProceso.findMany({
    where: { completada: true },
    select: { idProspecto: true, etapa: true }
  });
  const embudoC = aggregateGlobalCumulative(etapasFilas);

  // Embudo global (todos los años): conteo acumulativo (matrícula cuenta en etapas previas)
  const totalCitas = totalProspectos;
  const embudoGlobal = [
    { label: "Citas de información", value: totalCitas },
    { label: "Inicio del proceso", value: embudoC.inicio },
    { label: "Pruebas", value: embudoC.pruebas },
    { label: "Observación", value: embudoC.observacion },
    { label: "Matrícula", value: embudoC.matricula }
  ];

  // Canales con matriculados
  const canalesConMatricula = await Promise.all(
    canalesTop.map(async (canal) => {
      const matriculados = await prisma.etapaProceso.count({
        where: {
          etapa: "MATRICULA",
          completada: true,
          prospecto: { canalLlegada: canal.canalLlegada }
        }
      });
      return {
        canal: canal.canalLlegada ?? "Sin canal",
        total: canal._count._all,
        matriculados,
        tasa: canal._count._all > 0
          ? Math.round((matriculados / canal._count._all) * 1000) / 10
          : 0
      };
    })
  );

  // Comparativo anual data
  const comparativoData = await buildComparativo();

  const prospectosSinSeguimiento2026 = await prisma.prospecto.count({
    where: {
      anioProceso: 2026,
      estadoProcesoCat: {
        notIn: ["matriculado", "no_admitido", "desiste", "no_continua_costos", "otro_colegio"]
      },
      seguimientos: { none: {} }
    }
  });

  return {
    totalProspectos,
    totalEstudiantes,
    totalEventos,
    matriculadosEtapa,
    prospectosPorAnio,
    embudoGlobal,
    canalesConMatricula,
    comparativoData,
    prospectos2026Activos,
    seguimientos2026,
    prospectosSinSeguimiento2026
  };
}

async function buildComparativo() {
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

  const byGroup = aggregateCumulativeByGroupKey(
    etapas.map((e) => ({
      idProspecto: e.idProspecto,
      etapa: e.etapa,
      groupKey: `${e.prospecto.anioProceso}|${nivelKey(e.prospecto.nivel)}`
    }))
  );

  return totales.map((row) => {
    const k = `${row.anioProceso}|${nivelKey(row.nivel)}`;
    const e = byGroup.get(k) ?? { inicio: 0, pruebas: 0, observacion: 0, matricula: 0 };
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

export default async function DashboardPage() {
  const data = await getDashboardData();
  const maxCanal = Math.max(...data.canalesConMatricula.map((c) => c.total), 1);
  const maxAnio = Math.max(...data.prospectosPorAnio.map((r) => r._count._all), 1);

  const tasaMatricula = data.totalProspectos > 0
    ? Math.round((data.matriculadosEtapa / data.totalProspectos) * 1000) / 10
    : 0;

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-fontan-blue">Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold text-fontan-ink">Gestión de admisiones</h1>
        <p className="mt-1 text-sm text-slate-500">
          Colegio Fontán · Datos históricos 2023–2026
        </p>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Prospectos totales"
          value={formatNumber(data.totalProspectos)}
          helper="Histórico 2023–2026"
        />
        <StatCard
          label="Estudiantes matriculados"
          value={formatNumber(data.totalEstudiantes)}
          helper="Base morral activa"
        />
        <StatCard
          label="Matrículas logradas"
          value={formatNumber(data.matriculadosEtapa)}
          helper={`Tasa global: ${tasaMatricula}%`}
        />
        <StatCard
          label="Eventos institucionales"
          value={formatNumber(data.totalEventos)}
          helper="Morral, asambleas, charlas"
        />
      </section>

      {/* Fila principal: Embudo + Comparativo */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Embudo global */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-fontan-ink">Embudo de conversión global</h2>
            <Link href="/analisis" className="text-xs text-fontan-blue hover:underline">
              Ver análisis completo →
            </Link>
          </div>
          <FunnelViz stages={data.embudoGlobal} />
          <p className="mt-3 text-xs text-slate-500">
            Cada paso incluye a quien ya avanzó más adelante: si figura matrícula, también cuenta en inicio,
            pruebas y observación, aunque no se hubiera marcado la casilla de inicio en el archivo.
          </p>
        </div>

        {/* Comparativo anual */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-fontan-ink">Comparativo por año</h2>
            <Link href="/reportes" className="text-xs text-fontan-blue hover:underline">
              Ver reportes →
            </Link>
          </div>
          <ComparativoAnual rows={data.comparativoData} />
        </div>
      </section>

      {/* Fila: Canales + Prospectos por año + CRM */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Top canales */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-fontan-ink">Canales de llegada</h2>
          <div className="space-y-3">
            {data.canalesConMatricula.map((c) => (
              <MiniBarRow
                key={c.canal}
                label={c.canal}
                value={c.total}
                max={maxCanal}
                secondary={`${c.matriculados} matr. · ${c.tasa}%`}
              />
            ))}
          </div>
          <Link href="/analisis" className="mt-4 block text-xs text-fontan-blue hover:underline">
            Análisis detallado de canales →
          </Link>
        </div>

        {/* Prospectos por año */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-fontan-ink">Citas por año</h2>
          <div className="space-y-3">
            {data.prospectosPorAnio.map((row) => (
              <MiniBarRow
                key={row.anioProceso}
                label={String(row.anioProceso)}
                value={row._count._all}
                max={maxAnio}
                color={row.anioProceso === 2026 ? "bg-fontan-green" : "bg-fontan-blue"}
              />
            ))}
          </div>
        </div>

        {/* Alertas CRM 2026 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-fontan-ink">CRM 2026 — Estado</h2>
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-2xl font-bold text-fontan-ink">
                {formatNumber(data.prospectos2026Activos)}
              </p>
              <p className="text-sm text-slate-600">prospectos activos 2026</p>
            </div>

            <div className={`rounded-xl p-4 ${data.prospectosSinSeguimiento2026 > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
              <p className={`text-2xl font-bold ${data.prospectosSinSeguimiento2026 > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {formatNumber(data.prospectosSinSeguimiento2026)}
              </p>
              <p className={`text-sm ${data.prospectosSinSeguimiento2026 > 0 ? "text-red-700" : "text-emerald-700"}`}>
                sin ningún seguimiento
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-2xl font-bold text-amber-700">
                {formatNumber(data.seguimientos2026)}
              </p>
              <p className="text-sm text-amber-800">contactos en últimos 14 días</p>
            </div>
          </div>

          <Link
            href="/seguimientos"
            className="mt-4 block rounded-full bg-fontan-blue px-4 py-2 text-center text-sm font-semibold text-white"
          >
            Ver seguimientos pendientes
          </Link>
        </div>
      </section>
    </div>
  );
}
