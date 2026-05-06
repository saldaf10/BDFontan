import { notFound } from "next/navigation";
import { updateProspecto } from "@/app/actions";
import { FormField, inputClass } from "@/components/FormField";
import { ESTADOS_PROCESO, GRADOS, NIVELES } from "@/lib/catalogs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EditarProspectoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function dateInputValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function EditarProspectoPage({ params }: EditarProspectoPageProps) {
  const { id } = await params;
  const prospecto = await prisma.prospecto.findUnique({
    where: { id },
    include: {
      estudiante: true,
      citasInformacion: { orderBy: { fecha: "asc" }, take: 1 }
    }
  });

  if (!prospecto) {
    notFound();
  }

  const cita = prospecto.citasInformacion[0];
  const action = updateProspecto.bind(null, prospecto.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fontan-ink">Editar prospecto</h1>
        <p className="mt-2 text-sm text-slate-600">
          Actualiza datos principales, estado y primera cita informativa.
        </p>
      </div>

      <form action={action} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <FormField label="Nombre del estudiante">
          <input name="nombreCompleto" required defaultValue={prospecto.estudiante?.nombreCompleto ?? ""} className={inputClass} />
        </FormField>
        <FormField label="Año del proceso">
          <input name="anioProceso" required defaultValue={prospecto.anioProceso} className={inputClass} />
        </FormField>
        <FormField label="Nivel">
          <select name="nivel" defaultValue={prospecto.nivel ?? ""} className={inputClass}>
            <option value="">Sin nivel</option>
            {NIVELES.map((nivel) => (
              <option key={nivel} value={nivel}>{nivel}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Grado principal">
          <select name="gradoPrimario" defaultValue={prospecto.gradoPrimario ?? ""} className={inputClass}>
            <option value="">Sin grado</option>
            {GRADOS.map((grado) => (
              <option key={grado} value={grado}>{grado}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Grado secundario">
          <select name="gradoSecundario" defaultValue={prospecto.gradoSecundario ?? ""} className={inputClass}>
            <option value="">No aplica</option>
            {GRADOS.map((grado) => (
              <option key={grado} value={grado}>{grado}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Estado">
          <select name="estadoProcesoCat" defaultValue={prospecto.estadoProcesoCat ?? "pendiente"} className={inputClass}>
            {ESTADOS_PROCESO.map((estado) => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Fecha de cita">
          <input name="fechaCita" type="date" defaultValue={dateInputValue(cita?.fecha)} className={inputClass} />
        </FormField>
        <FormField label="Asistió">
          <select name="asistio" defaultValue={cita?.asistio === null || cita?.asistio === undefined ? "" : String(cita.asistio)} className={inputClass}>
            <option value="">Sin dato</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </FormField>
        <FormField label="Tipo de contacto">
          <input name="tipoContacto" defaultValue={cita?.tipoContacto ?? ""} className={inputClass} />
        </FormField>
        <FormField label="Asesor">
          <input name="asesor" defaultValue={prospecto.asesor ?? ""} className={inputClass} />
        </FormField>
        <FormField label="Canal normalizado">
          <input name="canalLlegada" defaultValue={prospecto.canalLlegada ?? ""} className={inputClass} />
        </FormField>
        <FormField label="Canal original">
          <input name="canalLlegadaOriginal" defaultValue={prospecto.canalLlegadaOriginal ?? ""} className={inputClass} />
        </FormField>
        <FormField label="Nombre referido">
          <input name="referidoNombre" defaultValue={prospecto.referidoNombre ?? ""} className={inputClass} />
        </FormField>
        <FormField label="Mes cita">
          <input name="mesCita" defaultValue={prospecto.mesCita ?? ""} className={inputClass} />
        </FormField>
        <FormField label="Flag CRM (OK1, OK2…)">
          <input name="flagOk" defaultValue={prospecto.flagOk ?? ""} className={inputClass} />
        </FormField>
        <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
          <input type="checkbox" name="contactoMejoresColegios" defaultChecked={prospecto.contactoMejoresColegios} />
          Contacto desde mejores colegios
        </label>
        <FormField label="Estado original">
          <textarea name="estadoProcesoOriginal" defaultValue={prospecto.estadoProcesoOriginal ?? ""} className={inputClass} rows={3} />
        </FormField>
        <FormField label="Observaciones">
          <textarea name="observaciones" defaultValue={prospecto.observaciones ?? ""} className={inputClass} rows={3} />
        </FormField>
        <FormField label="Observaciones de la cita">
          <textarea name="observacionesCita" defaultValue={cita?.observaciones ?? ""} className={inputClass} rows={3} />
        </FormField>
        <div className="flex items-end">
          <button className="rounded-full bg-fontan-blue px-5 py-2 text-sm font-semibold text-white">
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
