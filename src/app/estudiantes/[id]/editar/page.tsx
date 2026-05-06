import Link from "next/link";
import { notFound } from "next/navigation";
import { updateEstudiante } from "@/app/actions";
import { FormField, inputClass } from "@/components/FormField";
import { GRADOS, NIVELES } from "@/lib/catalogs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EditarEstudiantePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarEstudiantePage({ params }: EditarEstudiantePageProps) {
  const { id } = await params;
  const estudiante = await prisma.estudiante.findUnique({ where: { id } });

  if (!estudiante) {
    notFound();
  }

  const action = updateEstudiante.bind(null, estudiante.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fontan-ink">Editar estudiante</h1>
          <p className="mt-2 text-sm text-slate-600">Ajusta datos administrativos. Los prospectos siguen en sus propias fichas.</p>
        </div>
        <Link href={`/estudiantes/${estudiante.id}`} className="text-sm text-fontan-blue">
          Volver al detalle
        </Link>
      </div>

      <form action={action} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <FormField label="Nombre completo">
          <input name="nombreCompleto" required defaultValue={estudiante.nombreCompleto} className={inputClass} />
        </FormField>
        <FormField label="Código interno">
          <input name="codigoInterno" defaultValue={estudiante.codigoInterno ?? ""} className={inputClass} />
        </FormField>
        <FormField label="Nivel">
          <select name="nivel" defaultValue={estudiante.nivel ?? ""} className={inputClass}>
            <option value="">Sin nivel</option>
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Grado">
          <select name="grado" defaultValue={estudiante.grado ?? ""} className={inputClass}>
            <option value="">Sin grado</option>
            {GRADOS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Año ingreso">
          <input name="anioIngreso" type="number" defaultValue={estudiante.anioIngreso ?? ""} className={inputClass} />
        </FormField>
        <FormField label="Origen (trazabilidad)">
          <input name="origenArchivo" defaultValue={estudiante.origenArchivo ?? ""} className={inputClass} />
        </FormField>
        <div className="flex items-end md:col-span-2">
          <button type="submit" className="rounded-full bg-fontan-blue px-5 py-2 text-sm font-semibold text-white">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
