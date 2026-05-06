import { createEvento } from "@/app/actions";
import { FormField, inputClass } from "@/components/FormField";
import { NIVELES, TIPOS_EVENTO } from "@/lib/catalogs";

export default function NuevoEventoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fontan-ink">Nuevo evento</h1>
        <p className="mt-2 text-sm text-slate-600">
          Crea eventos institucionales para registrar asistencia posteriormente.
        </p>
      </div>
      <form action={createEvento} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <FormField label="Nombre">
          <input name="nombre" required className={inputClass} />
        </FormField>
        <FormField label="Fecha">
          <input type="date" name="fecha" required className={inputClass} />
        </FormField>
        <FormField label="Tipo">
          <select name="tipo" className={inputClass}>
            {TIPOS_EVENTO.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Nivel">
          <select name="nivel" className={inputClass}>
            <option value="TODOS">TODOS</option>
            {NIVELES.map((nivel) => (
              <option key={nivel} value={nivel}>{nivel}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Año escolar">
          <input name="anioEscolar" placeholder="24-25, 2026..." className={inputClass} />
        </FormField>
        <div className="flex items-end">
          <button className="rounded-full bg-fontan-blue px-5 py-2 text-sm font-semibold text-white">
            Crear evento
          </button>
        </div>
      </form>
    </div>
  );
}
