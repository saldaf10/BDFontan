import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { EventoTableRow } from "@/components/EventoTableRow";
import { inputClass } from "@/components/FormField";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import type { Prisma } from "@prisma/client";
import { NIVELES, TIPOS_EVENTO } from "@/lib/catalogs";

export const dynamic = "force-dynamic";

type EventosPageProps = {
  searchParams: Promise<{
    q?: string;
    nivel?: string;
    tipo?: string;
    anioEscolar?: string;
  }>;
};

export default async function EventosPage({ searchParams }: EventosPageProps) {
  const params = await searchParams;
  const q = params.q?.trim();

  const where: Prisma.EventoInstitucionalWhereInput = {
    ...(params.nivel ? { nivel: params.nivel } : {}),
    ...(params.tipo ? { tipo: params.tipo } : {}),
    ...(params.anioEscolar ? { anioEscolar: params.anioEscolar } : {}),
    ...(q ? { nombre: { contains: q, mode: "insensitive" } } : {})
  };

  const eventos = await prisma.eventoInstitucional.findMany({
    where,
    include: {
      _count: { select: { asistencias: true } }
    },
    orderBy: { fecha: "desc" },
    take: 200
  });

  const ids = eventos.map((e) => e.id);
  const breakdown =
    ids.length > 0
      ? await prisma.asistenciaEvento.groupBy({
          by: ["idEvento", "resultado"],
          where: { idEvento: { in: ids } },
          _count: { _all: true }
        })
      : [];

  const statsMap = new Map<string, Record<string, number>>();
  for (const row of breakdown) {
    const current = statsMap.get(row.idEvento) ?? {};
    current[row.resultado] = row._count._all;
    statsMap.set(row.idEvento, current);
  }

  const anios = await prisma.eventoInstitucional.findMany({
    distinct: ["anioEscolar"],
    where: { anioEscolar: { not: null } },
    select: { anioEscolar: true },
    orderBy: { anioEscolar: "asc" }
  });

  if (eventos.length === 0 && !q && !params.nivel && !params.tipo && !params.anioEscolar) {
    return (
      <EmptyState
        title="Aun no hay eventos"
        description="Los eventos se cargan desde el Morral o puedes crearlos con el botón Nuevo evento."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fontan-ink">Eventos institucionales</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cada evento concentra asistencias SI/NO/EXCUSA como en el Excel del morral. Abre uno para ver la planilla
            completa y registrar nuevas asistencias.
          </p>
        </div>
        <Link href="/eventos/nuevo" className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white">
          Nuevo evento
        </Link>
      </div>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6">
        <input name="q" defaultValue={params.q} placeholder="Buscar por nombre..." className={`${inputClass} md:col-span-2`} />
        <select name="nivel" defaultValue={params.nivel ?? ""} className={inputClass}>
          <option value="">Todos los niveles</option>
          {NIVELES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={params.tipo ?? ""} className={inputClass}>
          <option value="">Todos los tipos</option>
          {TIPOS_EVENTO.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select name="anioEscolar" defaultValue={params.anioEscolar ?? ""} className={inputClass}>
          <option value="">Todos los años escolares</option>
          {anios.map((a) => (
            <option key={a.anioEscolar ?? ""} value={a.anioEscolar ?? ""}>
              {a.anioEscolar}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white">Filtrar</button>
          <Link href="/eventos" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">
            Limpiar
          </Link>
        </div>
      </form>

      {eventos.length === 0 ? (
        <EmptyState title="Sin resultados" description="Prueba otros filtros o crea un evento nuevo." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Nivel / Año</th>
                <th className="px-4 py-3">Registros</th>
                <th className="px-4 py-3">SI / NO / EXC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eventos.map((evento) => {
                const st = statsMap.get(evento.id) ?? {};
                return (
                  <EventoTableRow key={evento.id} id={evento.id}>
                    <td className="px-4 py-3 font-medium text-fontan-blue">{evento.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(evento.fecha)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {evento.nivel ?? "—"} · {evento.anioEscolar ?? "—"}
                      {evento.tipo ? (
                        <span className="block text-xs text-slate-500">{evento.tipo}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{evento._count.asistencias}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {st.SI ?? 0} / {st.NO ?? 0} / {st.EXCUSA ?? 0}
                    </td>
                  </EventoTableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
