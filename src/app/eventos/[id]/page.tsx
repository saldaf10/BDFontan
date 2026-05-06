import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAsistencia, recordAsistencia, updateEvento } from "@/app/actions";
import { FormField, inputClass } from "@/components/FormField";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import type { Prisma } from "@prisma/client";
import { NIVELES, RESULTADOS_ASISTENCIA, TIPOS_EVENTO } from "@/lib/catalogs";
import { madrePadreDesdeAcudientes, nivelEtiqueta } from "@/lib/morral-family";

export const dynamic = "force-dynamic";

const ASISTENCIAS_TAKE = 3500;

type EventoDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    resultado?: string;
  }>;
};

function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function EventoDetailPage({ params, searchParams }: EventoDetailPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const q = sp.q?.trim();
  const filtroResultado = sp.resultado?.trim();

  const evento = await prisma.eventoInstitucional.findUnique({
    where: { id },
    include: {
      _count: { select: { asistencias: true } }
    }
  });

  if (!evento) {
    notFound();
  }

  const stats = await prisma.asistenciaEvento.groupBy({
    by: ["resultado"],
    where: { idEvento: id },
    _count: { _all: true }
  });
  const statMap = Object.fromEntries(stats.map((s) => [s.resultado, s._count._all]));

  const whereAsistencia: Prisma.AsistenciaEventoWhereInput = {
    idEvento: id,
    ...(filtroResultado ? { resultado: filtroResultado } : {})
  };

  const asistencias = await prisma.asistenciaEvento.findMany({
    where: whereAsistencia,
    include: {
      estudiante: {
        include: {
          acudientes: {
            include: { acudiente: true },
            orderBy: [{ orden: "asc" }, { relacion: "asc" }]
          }
        }
      }
    },
    orderBy: [{ estudiante: { grado: "asc" } }, { estudiante: { nombreCompleto: "asc" } }],
    take: ASISTENCIAS_TAKE
  });

  const coincidencias =
    q && q.length >= 2
      ? await prisma.estudiante.findMany({
          where: {
            OR: [
              { nombreCompleto: { contains: q, mode: "insensitive" } },
              { codigoInterno: { contains: q, mode: "insensitive" } }
            ]
          },
          include: {
            acudientes: { include: { acudiente: true }, orderBy: { orden: "asc" } }
          },
          orderBy: { nombreCompleto: "asc" },
          take: 30
        })
      : [];

  const updateAction = updateEvento.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            <Link href="/eventos" className="text-fontan-blue hover:underline">
              ← Todos los eventos
            </Link>
          </p>
          <h1 className="mt-2 text-3xl font-bold text-fontan-ink">{evento.nombre}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {formatDate(evento.fecha)} · {evento.nivel ? nivelEtiqueta(evento.nivel) : "Sin nivel en evento"} ·{" "}
            {evento.anioEscolar ?? "—"} · {evento.tipo ?? "sin tipo"}
          </p>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Misma lógica que el Excel del morral: por fila verás estudiante, grado, si es Preescolar / Primaria /
            Bachillerato, datos de contacto de madre y padre, y el resultado de asistencia (SI, NO o EXCUSA).
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Mostrando hasta {ASISTENCIAS_TAKE} filas en esta vista · Total en base: {evento._count.asistencias}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/api/eventos/${id}/export`}
            className="rounded-full bg-fontan-green px-4 py-2 text-sm font-semibold text-white"
          >
            Descargar CSV (con familia)
          </Link>
        </div>
      </div>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
        {RESULTADOS_ASISTENCIA.map((r) => (
          <div key={r}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{r}</p>
            <p className="mt-1 text-2xl font-semibold text-fontan-ink">{statMap[r] ?? 0}</p>
          </div>
        ))}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total registros</p>
          <p className="mt-1 text-2xl font-semibold text-fontan-ink">{evento._count.asistencias}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-fontan-ink">Familias (vista tipo planilla Morral)</h2>
            <p className="mt-1 text-sm text-slate-600">
              Columnas alineadas al Excel: código, grado, nombre, nivel educativo, madre, correos, padre, asistencia.
            </p>
          </div>
          <form className="flex flex-wrap items-center gap-2" method="get">
            <input type="hidden" name="q" value={q ?? ""} />
            <select name="resultado" defaultValue={filtroResultado ?? ""} className={inputClass}>
              <option value="">Todos los resultados</option>
              {RESULTADOS_ASISTENCIA.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-full border border-slate-300 px-3 py-2 text-sm">
              Filtrar
            </button>
          </form>
        </div>

        <div className="mt-4 max-h-[70vh] overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-[1100px] w-full divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="whitespace-nowrap px-3 py-2">Código</th>
                <th className="whitespace-nowrap px-3 py-2">Grado</th>
                <th className="min-w-[180px] px-3 py-2">Nombre completo</th>
                <th className="whitespace-nowrap px-3 py-2">Nivel</th>
                <th className="min-w-[140px] px-3 py-2">Nombre madre</th>
                <th className="min-w-[160px] px-3 py-2">Email madre</th>
                <th className="min-w-[140px] px-3 py-2">Nombre padre</th>
                <th className="min-w-[160px] px-3 py-2">Email padre</th>
                <th className="whitespace-nowrap px-3 py-2">Asistencia</th>
                <th className="min-w-[100px] px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {asistencias.map((a) => {
                const { madre, padre } = madrePadreDesdeAcudientes(a.estudiante.acudientes);
                const patch = recordAsistencia.bind(null, id, a.idEstudiante);
                const remove = deleteAsistencia.bind(null, a.id, id);
                return (
                  <tr key={a.id} className="align-top hover:bg-slate-50/80">
                    <td className="px-3 py-2 text-slate-700">{a.estudiante.codigoInterno ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">{a.estudiante.grado ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Link href={`/estudiantes/${a.estudiante.id}`} className="font-medium text-fontan-blue hover:underline">
                        {a.estudiante.nombreCompleto}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {nivelEtiqueta(a.estudiante.nivel)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{madre?.nombreCompleto ?? "—"}</td>
                    <td className="break-all px-3 py-2 text-slate-600">
                      {madre?.email ? (
                        <a href={`mailto:${madre.email}`} className="text-fontan-blue hover:underline">
                          {madre.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{padre?.nombreCompleto ?? "—"}</td>
                    <td className="break-all px-3 py-2 text-slate-600">
                      {padre?.email ? (
                        <a href={`mailto:${padre.email}`} className="text-fontan-blue hover:underline">
                          {padre.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">
                        {a.resultado}
                      </span>
                      {a.excusa ? <p className="mt-1 max-w-[200px] text-xs text-amber-800">{a.excusa}</p> : null}
                    </td>
                    <td className="px-3 py-2">
                      <form action={patch} className="mb-2 flex flex-col gap-1">
                        <select name="resultado" defaultValue={a.resultado} className={inputClass + " py-1 text-xs"}>
                          {RESULTADOS_ASISTENCIA.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <input
                          name="excusa"
                          defaultValue={a.excusa ?? ""}
                          placeholder="Excusa"
                          className={inputClass + " py-1 text-xs"}
                        />
                        <button type="submit" className="text-left text-xs font-medium text-fontan-blue">
                          Actualizar
                        </button>
                      </form>
                      <form action={remove}>
                        <button type="submit" className="text-xs text-red-600 hover:underline">
                          Quitar fila
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-fontan-ink">Registrar otra familia (búsqueda)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Busca por nombre o código (como filtrarías en el Excel). Al guardar, la fila aparece arriba con madre/padre
          si ya están en la ficha del estudiante.
        </p>
        <form className="mt-4 flex flex-wrap gap-3" method="get">
          <input type="hidden" name="resultado" value={filtroResultado ?? ""} />
          <input name="q" defaultValue={q} placeholder="Ej. apellido o código 2024…" className={inputClass + " min-w-[200px]"} />
          <button type="submit" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">
            Buscar
          </button>
        </form>

        {coincidencias.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {coincidencias.map((est) => {
              const quick = recordAsistencia.bind(null, id, est.id);
              const { madre, padre } = madrePadreDesdeAcudientes(est.acudientes);
              return (
                <li
                  key={est.id}
                  className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 p-4"
                >
                  <div className="min-w-[240px]">
                    <p className="font-medium text-fontan-ink">{est.nombreCompleto}</p>
                    <p className="text-xs text-slate-500">
                      {est.grado ?? "—"} · {nivelEtiqueta(est.nivel)} · {est.codigoInterno ?? "sin código"}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      Madre: {madre?.nombreCompleto ?? "—"} {madre?.email ? `· ${madre.email}` : ""}
                    </p>
                    <p className="text-xs text-slate-600">
                      Padre: {padre?.nombreCompleto ?? "—"} {padre?.email ? `· ${padre.email}` : ""}
                    </p>
                  </div>
                  <form action={quick} className="flex flex-wrap items-end gap-2">
                    <FormField label="Resultado">
                      <select name="resultado" defaultValue="SI" className={inputClass}>
                        {RESULTADOS_ASISTENCIA.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Excusa (si aplica)">
                      <input name="excusa" className={inputClass + " w-48"} placeholder="Motivo" />
                    </FormField>
                    <button type="submit" className="rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold text-white">
                      Guardar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : q && q.length >= 2 ? (
          <p className="mt-4 text-sm text-slate-500">No hay estudiantes que coincidan.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-fontan-ink">Editar datos del evento</h2>
        <p className="mt-1 text-sm text-slate-600">Nombre, fecha, tipo, nivel y año escolar (metadatos del evento).</p>
        <form action={updateAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField label="Nombre">
            <input name="nombre" required defaultValue={evento.nombre} className={inputClass} />
          </FormField>
          <FormField label="Fecha">
            <input type="date" name="fecha" required defaultValue={dateInputValue(evento.fecha)} className={inputClass} />
          </FormField>
          <FormField label="Tipo">
            <select name="tipo" defaultValue={evento.tipo ?? "OTRO"} className={inputClass}>
              {TIPOS_EVENTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Nivel">
            <select name="nivel" defaultValue={evento.nivel ?? ""} className={inputClass}>
              <option value="">—</option>
              <option value="TODOS">TODOS</option>
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Año escolar">
            <input name="anioEscolar" defaultValue={evento.anioEscolar ?? ""} placeholder="24-25, 2026" className={inputClass} />
          </FormField>
          <div className="flex items-end">
            <button type="submit" className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white">
              Guardar evento
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
