import Link from "next/link";
import { notFound } from "next/navigation";
import { addAcudienteToEstudiante } from "@/app/actions";
import { FormField, inputClass } from "@/components/FormField";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type EstudianteDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EstudianteDetailPage({ params }: EstudianteDetailPageProps) {
  const { id } = await params;
  const addAcudiente = addAcudienteToEstudiante.bind(null, id);

  const estudiante = await prisma.estudiante.findUnique({
    where: { id },
    include: {
      acudientes: { include: { acudiente: true }, orderBy: { orden: "asc" } },
      asistencias: { include: { evento: true }, orderBy: { evento: { fecha: "desc" } } },
      prospectos: {
        select: {
          id: true,
          anioProceso: true,
          estadoProcesoCat: true,
          nivel: true,
          gradoPrimario: true
        },
        orderBy: { anioProceso: "desc" }
      }
    }
  });

  if (!estudiante) {
    notFound();
  }

  const resumen = estudiante.asistencias.reduce(
    (acc, a) => {
      acc.total += 1;
      acc[a.resultado] = (acc[a.resultado] ?? 0) + 1;
      return acc;
    },
    { total: 0 } as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-fontan-ink">{estudiante.nombreCompleto}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {estudiante.nivel ?? "Sin nivel"} · {estudiante.grado ?? "Sin grado"}
            {estudiante.codigoInterno ? ` · Código ${estudiante.codigoInterno}` : ""}
            {estudiante.anioIngreso ? ` · Ingreso ${estudiante.anioIngreso}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">Origen migración: {estudiante.origenArchivo ?? "—"}</p>
        </div>
        <Link
          href={`/estudiantes/${estudiante.id}/editar`}
          className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white"
        >
          Editar ficha
        </Link>
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eventos registrados</p>
          <p className="mt-1 text-2xl font-semibold text-fontan-ink">{resumen.total}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asistió (SI)</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{resumen.SI ?? 0}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">No asistió</p>
          <p className="mt-1 text-2xl font-semibold text-slate-700">{resumen.NO ?? 0}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Excusas</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{resumen.EXCUSA ?? 0}</p>
        </div>
      </section>

      {estudiante.prospectos.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-fontan-ink">Prospectos vinculados</h2>
          <p className="mt-1 text-sm text-slate-600">Historial de admisiones para este mismo estudiante en la base.</p>
          <ul className="mt-4 space-y-2">
            {estudiante.prospectos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <span>
                  Proceso {p.anioProceso} · {p.nivel ?? "—"} · {p.gradoPrimario ?? "—"} ·{" "}
                  <span className="text-slate-600">{p.estadoProcesoCat ?? "pendiente"}</span>
                </span>
                <Link href={`/prospectos/${p.id}`} className="font-medium text-fontan-blue">
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-fontan-ink">Acudientes</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {estudiante.acudientes.map(({ acudiente, relacion, orden }) => (
            <div key={`${acudiente.id}-${relacion}`} className="rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-medium">{acudiente.nombreCompleto}</p>
              <p className="text-slate-600">
                {relacion ?? "Acudiente"}
                {orden != null ? ` · orden ${orden}` : ""}
              </p>
              <p className="text-slate-600">{acudiente.email ?? acudiente.telefono ?? "Sin contacto"}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-fontan-ink">Agregar acudiente</h3>
          <form action={addAcudiente} className="mt-3 grid gap-3 md:grid-cols-3">
            <FormField label="Nombre completo">
              <input name="nombreAcudiente" required className={inputClass} />
            </FormField>
            <FormField label="Relación">
              <select name="relacion" className={inputClass}>
                <option value="MADRE">MADRE</option>
                <option value="PADRE">PADRE</option>
                <option value="OTRO">OTRO</option>
              </select>
            </FormField>
            <FormField label="Orden (1 principal)">
              <input name="orden" type="number" min={1} defaultValue={3} className={inputClass} />
            </FormField>
            <FormField label="Correo">
              <input name="emailAcudiente" type="email" className={inputClass} />
            </FormField>
            <FormField label="Teléfono">
              <input name="telefonoAcudiente" className={inputClass} />
            </FormField>
            <div className="flex items-end">
              <button type="submit" className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white">
                Guardar
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-fontan-ink">Asistencia a eventos</h2>
        <div className="mt-4 space-y-3">
          {estudiante.asistencias.map((asistencia) => (
            <div key={asistencia.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-4 text-sm">
              <div>
                <Link href={`/eventos/${asistencia.evento.id}`} className="font-medium text-fontan-blue">
                  {asistencia.evento.nombre}
                </Link>
                <p className="text-slate-600">{formatDate(asistencia.evento.fecha)}</p>
                {asistencia.excusa ? (
                  <p className="mt-1 text-xs text-slate-500">Excusa: {asistencia.excusa}</p>
                ) : null}
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-fontan-ink">
                {asistencia.resultado}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
