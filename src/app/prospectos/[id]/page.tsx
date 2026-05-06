import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createCitaInformacion,
  createSeguimiento,
  deleteCitaInformacion,
  updateCitaInformacion,
  upsertEtapa
} from "@/app/actions";
import { FormField, inputClass } from "@/components/FormField";
import { ETAPAS } from "@/lib/catalogs";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type ProspectoDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function dateInputValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function ProspectoDetailPage({ params }: ProspectoDetailPageProps) {
  const { id } = await params;
  const seguimientoAction = createSeguimiento.bind(null, id);
  const etapaAction = upsertEtapa.bind(null, id);
  const nuevaCitaAction = createCitaInformacion.bind(null, id);

  const prospecto = await prisma.prospecto.findUnique({
    where: { id },
    include: {
      estudiante: {
        include: {
          acudientes: { include: { acudiente: true } }
        }
      },
      citasInformacion: { orderBy: { fecha: "asc" } },
      etapas: { orderBy: { createdAt: "asc" } },
      seguimientos: { orderBy: [{ numeroContacto: "asc" }, { fecha: "asc" }] }
    }
  });

  if (!prospecto) {
    notFound();
  }

  const citasOrdenadas = [...prospecto.citasInformacion].sort((a, b) => {
    const fa = a.fecha?.getTime() ?? 0;
    const fb = b.fecha?.getTime() ?? 0;
    return fa - fb;
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-fontan-blue">Prospecto {prospecto.anioProceso}</p>
          <h1 className="mt-2 text-3xl font-bold text-fontan-ink">
            {prospecto.estudiante?.nombreCompleto ?? "Sin estudiante"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {prospecto.nivel ?? "Sin nivel"} · {prospecto.gradoPrimario ?? "Sin grado"} ·{" "}
            {prospecto.gradoSecundario ? `${prospecto.gradoSecundario} (sec.) · ` : ""}
            {prospecto.canalLlegada ?? "Sin canal"} · {prospecto.estadoProcesoCat ?? "pendiente"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Origen: {prospecto.origenArchivo ?? "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {prospecto.estudiante ? (
            <Link
              href={`/estudiantes/${prospecto.estudiante.id}`}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Ver estudiante
            </Link>
          ) : null}
          <Link
            href={`/prospectos/${prospecto.id}/editar`}
            className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white"
          >
            Editar prospecto
          </Link>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 lg:grid-cols-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asesor</h3>
          <p className="mt-1 text-sm text-fontan-ink">{prospecto.asesor ?? "—"}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Canal</h3>
          <p className="mt-1 text-sm text-fontan-ink">{prospecto.canalLlegada ?? "—"}</p>
          <p className="text-xs text-slate-500">{prospecto.canalLlegadaOriginal ?? ""}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Referido</h3>
          <p className="mt-1 text-sm text-fontan-ink">{prospecto.referidoNombre ?? "—"}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mes cita</h3>
          <p className="mt-1 text-sm text-fontan-ink">{prospecto.mesCita ?? "—"}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seguimiento CRM</h3>
          <p className="mt-1 text-sm text-fontan-ink">{prospecto.flagOk ?? "—"}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mejores colegios</h3>
          <p className="mt-1 text-sm text-fontan-ink">{prospecto.contactoMejoresColegios ? "Sí" : "No"}</p>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado (texto original)</h3>
          <p className="mt-1 text-sm text-slate-700">{prospecto.estadoProcesoOriginal ?? "—"}</p>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{prospecto.observaciones ?? "—"}</p>
        </div>
      </section>

      {prospecto.estudiante && prospecto.estudiante.acudientes.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-fontan-ink">Acudientes (desde ficha estudiante)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {prospecto.estudiante.acudientes.map(({ acudiente, relacion, orden }) => (
              <div key={acudiente.id} className="rounded-xl bg-slate-50 p-4 text-sm">
                <p className="font-medium">{acudiente.nombreCompleto}</p>
                <p className="text-slate-600">
                  {relacion ?? "Acudiente"} {orden != null ? `· orden ${orden}` : ""}
                </p>
                <p className="text-slate-600">{acudiente.email ?? acudiente.telefono ?? "Sin contacto"}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-fontan-ink">Citas de información ({citasOrdenadas.length})</h2>
          <p className="mt-1 text-sm text-slate-600">
            Historial completo de citas. Edita cada una o agrega nuevas sin perder el registro previo.
          </p>
          <div className="mt-4 space-y-4">
            {citasOrdenadas.map((cita) => {
              const updateAction = updateCitaInformacion.bind(null, cita.id, id);
              const deleteAction = deleteCitaInformacion.bind(null, cita.id, id);
              return (
                <div key={cita.id} className="rounded-xl border border-slate-200 p-4">
                  <form action={updateAction} className="grid gap-3 md:grid-cols-2">
                    <FormField label="Fecha">
                      <input type="date" name="fecha" defaultValue={dateInputValue(cita.fecha)} className={inputClass} />
                    </FormField>
                    <FormField label="Asistió">
                      <select
                        name="asistio"
                        defaultValue={cita.asistio === null || cita.asistio === undefined ? "" : String(cita.asistio)}
                        className={inputClass}
                      >
                        <option value="">Sin dato</option>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </FormField>
                    <FormField label="Tipo de contacto">
                      <input name="tipoContacto" defaultValue={cita.tipoContacto ?? ""} className={inputClass} />
                    </FormField>
                    <div className="flex items-end gap-2">
                      <button
                        type="submit"
                        className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Guardar
                      </button>
                    </div>
                    <div className="md:col-span-2">
                      <FormField label="Observaciones">
                        <textarea name="observaciones" defaultValue={cita.observaciones ?? ""} className={inputClass} rows={2} />
                      </FormField>
                    </div>
                  </form>
                  <form action={deleteAction} className="mt-2 text-right">
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      Eliminar cita
                    </button>
                  </form>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-fontan-ink">Agregar otra cita</h3>
            <form action={nuevaCitaAction} className="mt-3 grid gap-3 md:grid-cols-2">
              <FormField label="Fecha">
                <input type="date" name="fecha" className={inputClass} />
              </FormField>
              <FormField label="Asistió">
                <select name="asistio" className={inputClass}>
                  <option value="">Sin dato</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </FormField>
              <FormField label="Tipo de contacto">
                <input name="tipoContacto" className={inputClass} />
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Observaciones">
                  <textarea name="observaciones" className={inputClass} rows={2} />
                </FormField>
              </div>
              <button type="submit" className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white">
                Agregar cita
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-fontan-ink">Etapas del proceso</h2>
          <div className="mt-4 space-y-3">
            {prospecto.etapas.map((etapa) => (
              <div key={etapa.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm">
                <span className="font-medium">{etapa.etapa}</span>
                <span className="text-slate-600">
                  {etapa.completada ? formatDate(etapa.fecha) : "Pendiente"}
                  {etapa.admitido !== null && etapa.admitido !== undefined ? ` · admitido: ${etapa.admitido ? "sí" : "no"}` : ""}
                </span>
              </div>
            ))}
          </div>
          <form action={etapaAction} className="mt-5 grid gap-3 rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-fontan-ink">Actualizar etapa</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Etapa">
                <select name="etapa" className={inputClass}>
                  {ETAPAS.map((etapa) => (
                    <option key={etapa} value={etapa}>
                      {etapa}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Fecha">
                <input type="date" name="fecha" className={inputClass} />
              </FormField>
              <FormField label="Admitido">
                <select name="admitido" className={inputClass}>
                  <option value="">Sin dato</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </FormField>
              <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
                <input type="checkbox" name="completada" />
                Etapa completada
              </label>
            </div>
            <button className="w-fit rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white">
              Guardar etapa
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-fontan-ink">Seguimientos</h2>
        <div className="mt-4 space-y-3">
          {prospecto.seguimientos.map((seguimiento) => (
            <div key={seguimiento.id} className="rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-medium">
                Contacto {seguimiento.numeroContacto} · {formatDate(seguimiento.fecha)}
              </p>
              <p className="text-slate-600">{seguimiento.medio ?? "Sin medio"}</p>
              {seguimiento.observacion ? <p className="mt-2 text-slate-600">{seguimiento.observacion}</p> : null}
            </div>
          ))}
        </div>
        <form action={seguimientoAction} className="mt-5 grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
          <FormField label="Contacto #">
            <input name="numeroContacto" defaultValue={prospecto.seguimientos.length + 1} className={inputClass} />
          </FormField>
          <FormField label="Fecha">
            <input type="date" name="fecha" className={inputClass} />
          </FormField>
          <FormField label="Medio">
            <input name="medio" placeholder="Whatsapp, llamada..." className={inputClass} />
          </FormField>
          <div className="flex items-end">
            <button className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white">Agregar</button>
          </div>
          <div className="md:col-span-4">
            <FormField label="Observación">
              <textarea name="observacion" className={inputClass} rows={3} />
            </FormField>
          </div>
        </form>
      </section>
    </div>
  );
}
