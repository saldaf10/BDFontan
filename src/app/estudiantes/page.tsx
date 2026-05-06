import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { inputClass } from "@/components/FormField";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { GRADOS, NIVELES } from "@/lib/catalogs";

export const dynamic = "force-dynamic";

type EstudiantesPageProps = {
  searchParams: Promise<{
    q?: string;
    nivel?: string;
    grado?: string;
  }>;
};

export default async function EstudiantesPage({ searchParams }: EstudiantesPageProps) {
  const params = await searchParams;
  const q = params.q?.trim();

  const where = {
    ...(params.nivel ? { nivel: params.nivel } : {}),
    ...(params.grado ? { grado: params.grado } : {}),
    ...(q
      ? {
          OR: [
            { nombreCompleto: { contains: q, mode: "insensitive" as const } },
            { codigoInterno: { contains: q, mode: "insensitive" as const } },
            { origenArchivo: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const estudiantes = await prisma.estudiante.findMany({
    where,
    include: {
      _count: {
        select: { asistencias: true, prospectos: true, acudientes: true }
      }
    },
    orderBy: { nombreCompleto: "asc" },
    take: 400
  });

  if (estudiantes.length === 0 && !q && !params.nivel && !params.grado) {
    return (
      <EmptyState
        title="Aun no hay estudiantes"
        description="La lista se llena con el archivo Morral y con prospectos vinculados."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fontan-ink">Estudiantes</h1>
          <p className="mt-2 text-sm text-slate-600">
            Busca por nombre, código o procedencia. Cada ficha muestra asistencias a eventos y prospectos
            vinculados.
          </p>
        </div>
      </div>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Nombre, código, origen..."
          className={`${inputClass} md:col-span-2`}
        />
        <select name="nivel" defaultValue={params.nivel ?? ""} className={inputClass}>
          <option value="">Todos los niveles</option>
          {NIVELES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select name="grado" defaultValue={params.grado ?? ""} className={inputClass}>
          <option value="">Todos los grados</option>
          {GRADOS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white">Buscar</button>
          <Link href="/estudiantes" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">
            Limpiar
          </Link>
        </div>
      </form>

      {estudiantes.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="Prueba con otros términos o quita filtros."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
            Mostrando {formatNumber(estudiantes.length)} estudiantes (máx. 400 en esta vista)
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Estudiante</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nivel · Grado</th>
                <th className="px-4 py-3">Prospectos</th>
                <th className="px-4 py-3">Eventos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estudiantes.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-fontan-ink">
                    <Link href={`/estudiantes/${e.id}`} className="text-fontan-blue hover:underline">
                      {e.nombreCompleto}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.codigoInterno ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.nivel ?? "—"} · {e.grado ?? "—"}
                  </td>
                  <td className="px-4 py-3">{e._count.prospectos}</td>
                  <td className="px-4 py-3">{e._count.asistencias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
