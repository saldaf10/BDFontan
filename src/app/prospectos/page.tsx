import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { inputClass } from "@/components/FormField";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { ESTADOS_PROCESO, NIVELES } from "@/lib/catalogs";

export const dynamic = "force-dynamic";

type ProspectosPageProps = {
  searchParams: Promise<{
    q?: string;
    anio?: string;
    nivel?: string;
    estado?: string;
    canal?: string;
  }>;
};

export default async function ProspectosPage({ searchParams }: ProspectosPageProps) {
  const params = await searchParams;
  const q = params.q?.trim();
  const anio = params.anio ? Number.parseInt(params.anio, 10) : undefined;
  const where = {
    ...(anio ? { anioProceso: anio } : {}),
    ...(params.nivel ? { nivel: params.nivel } : {}),
    ...(params.estado ? { estadoProcesoCat: params.estado } : {}),
    ...(params.canal ? { canalLlegada: params.canal } : {}),
    ...(q
      ? {
          OR: [
            { estudiante: { nombreCompleto: { contains: q, mode: "insensitive" as const } } },
            { gradoPrimario: { contains: q, mode: "insensitive" as const } },
            { asesor: { contains: q, mode: "insensitive" as const } },
            { canalLlegadaOriginal: { contains: q, mode: "insensitive" as const } },
            { estadoProcesoOriginal: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const prospectos = await prisma.prospecto.findMany({
    where,
    include: {
      estudiante: true,
      citasInformacion: {
        orderBy: { fecha: "asc" },
        take: 1
      }
    },
    orderBy: [{ anioProceso: "desc" }, { createdAt: "desc" }],
    take: 250
  });
  const canales = await prisma.prospecto.findMany({
    distinct: ["canalLlegada"],
    where: { canalLlegada: { not: null } },
    select: { canalLlegada: true },
    orderBy: { canalLlegada: "asc" }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fontan-ink">Prospectos</h1>
          <p className="mt-2 text-sm text-slate-600">
            Busca, filtra y abre el historial completo de cada familia.
          </p>
        </div>
        <Link
          href="/prospectos/nuevo"
          className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white"
        >
          Nuevo prospecto
        </Link>
      </div>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Nombre, asesor, canal, estado..."
          className={`${inputClass} md:col-span-2`}
        />
        <input name="anio" defaultValue={params.anio} placeholder="Año" className={inputClass} />
        <select name="nivel" defaultValue={params.nivel ?? ""} className={inputClass}>
          <option value="">Todos los niveles</option>
          {NIVELES.map((nivel) => (
            <option key={nivel} value={nivel}>
              {nivel}
            </option>
          ))}
        </select>
        <select name="estado" defaultValue={params.estado ?? ""} className={inputClass}>
          <option value="">Todos los estados</option>
          {ESTADOS_PROCESO.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
        <select name="canal" defaultValue={params.canal ?? ""} className={inputClass}>
          <option value="">Todos los canales</option>
          {canales.map((canal) => (
            <option key={canal.canalLlegada} value={canal.canalLlegada ?? ""}>
              {canal.canalLlegada}
            </option>
          ))}
        </select>
        <div className="flex gap-2 md:col-span-6">
          <button className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white">
            Filtrar
          </button>
          <Link href="/prospectos" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">
            Limpiar
          </Link>
        </div>
      </form>

      {prospectos.length === 0 ? (
        <EmptyState
          title="Aun no hay prospectos"
          description="Ejecuta el ETL y la carga a PostgreSQL para empezar a consultar el embudo."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Grado</th>
                <th className="px-4 py-3">Cita</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prospectos.map((prospecto) => (
                <tr key={prospecto.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-fontan-ink">
                    <Link href={`/prospectos/${prospecto.id}`}>
                      {prospecto.estudiante?.nombreCompleto ?? "Sin estudiante"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{prospecto.anioProceso}</td>
                  <td className="px-4 py-3">{prospecto.nivel ?? "-"}</td>
                  <td className="px-4 py-3">{prospecto.gradoPrimario ?? "-"}</td>
                  <td className="px-4 py-3">{formatDate(prospecto.citasInformacion[0]?.fecha)}</td>
                  <td className="px-4 py-3">{prospecto.estadoProcesoCat ?? "pendiente"}</td>
                  <td className="px-4 py-3">{prospecto.canalLlegada ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/prospectos/${prospecto.id}/editar`} className="text-fontan-blue">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
