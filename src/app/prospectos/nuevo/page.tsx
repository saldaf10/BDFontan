import { createProspecto } from "@/app/actions";
import { FormField, inputClass } from "@/components/FormField";
import { ESTADOS_PROCESO, GRADOS, NIVELES } from "@/lib/catalogs";

export default function NuevoProspectoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fontan-ink">Nuevo prospecto</h1>
        <p className="mt-2 text-sm text-slate-600">
          Crea una familia nueva con estudiante, cita informativa y estado inicial.
        </p>
      </div>

      <form action={createProspecto} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <FormField label="Nombre del estudiante">
          <input name="nombreCompleto" required className={inputClass} />
        </FormField>
        <FormField label="Año del proceso">
          <input name="anioProceso" required defaultValue={new Date().getFullYear()} className={inputClass} />
        </FormField>
        <FormField label="Nivel">
          <select name="nivel" className={inputClass}>
            <option value="">Sin nivel</option>
            {NIVELES.map((nivel) => (
              <option key={nivel} value={nivel}>{nivel}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Grado principal">
          <select name="gradoPrimario" className={inputClass}>
            <option value="">Sin grado</option>
            {GRADOS.map((grado) => (
              <option key={grado} value={grado}>{grado}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Grado secundario">
          <select name="gradoSecundario" className={inputClass}>
            <option value="">No aplica</option>
            {GRADOS.map((grado) => (
              <option key={grado} value={grado}>{grado}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Estado">
          <select name="estadoProcesoCat" defaultValue="pendiente" className={inputClass}>
            {ESTADOS_PROCESO.map((estado) => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Fecha de cita">
          <input name="fechaCita" type="date" className={inputClass} />
        </FormField>
        <FormField label="Asistió">
          <select name="asistio" className={inputClass}>
            <option value="">Sin dato</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </FormField>
        <FormField label="Tipo de contacto">
          <input name="tipoContacto" placeholder="Whatsapp, llamada, virtual..." className={inputClass} />
        </FormField>
        <FormField label="Asesor">
          <input name="asesor" className={inputClass} />
        </FormField>
        <FormField label="Canal normalizado">
          <input name="canalLlegada" placeholder="referido_familia, internet..." className={inputClass} />
        </FormField>
        <FormField label="Canal original">
          <input name="canalLlegadaOriginal" className={inputClass} />
        </FormField>
        <FormField label="Nombre referido">
          <input name="referidoNombre" className={inputClass} />
        </FormField>
        <FormField label="Mes cita">
          <input name="mesCita" className={inputClass} />
        </FormField>
        <FormField label="Flag CRM (OK1, OK2…)">
          <input name="flagOk" className={inputClass} />
        </FormField>
        <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
          <input type="checkbox" name="contactoMejoresColegios" />
          Contacto desde mejores colegios
        </label>
        <FormField label="Estado original">
          <textarea name="estadoProcesoOriginal" className={inputClass} rows={3} />
        </FormField>
        <FormField label="Observaciones">
          <textarea name="observaciones" className={inputClass} rows={3} />
        </FormField>
        <FormField label="Observaciones de la cita">
          <textarea name="observacionesCita" className={inputClass} rows={3} />
        </FormField>
        <div className="flex items-end">
          <button className="rounded-full bg-fontan-blue px-5 py-2 text-sm font-semibold text-white">
            Crear prospecto
          </button>
        </div>
      </form>
    </div>
  );
}
