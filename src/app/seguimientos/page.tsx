/**
 * /seguimientos — CRM de seguimiento activo
 *
 * Lista los prospectos que requieren contacto:
 * - Sin seguimiento alguno (urgente inmediato)
 * - Último contacto hace más de 14 días
 * - Estados activos (pendiente, pensando, proceso_futuro)
 *
 * Permite filtrar por nivel, estado, y ver el detalle de cada prospecto.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatNumber } from "@/lib/format";
import { NIVELES } from "@/lib/catalogs";
import { inputClass } from "@/components/FormField";

export const dynamic = "force-dynamic";

const ESTADOS_ACTIVOS = ["pendiente", "pensando", "proceso_futuro", "no_responde"];
const ESTADOS_PERDIDOS = ["matriculado", "no_admitido", "desiste", "no_continua_costos", "otro_colegio", "edad_insuficiente", "necesidades_especiales"];
const DIAS_UMBRAL = 14;

type SeguimientosPageProps = {
  searchParams: Promise<{
    anio?: string;
    nivel?: string;
    estado?: string;
    urgente?: string;
  }>;
};

function diasColor(dias: number | null, sinSeguimiento: boolean): string {
  if (sinSeguimiento) return "text-red-600 font-bold";
  if (dias === null) return "text-slate-400";
  if (dias >= 30) return "text-red-600 font-semibold";
  if (dias >= DIAS_UMBRAL) return "text-amber-600 font-semibold";
  return "text-emerald-600";
}

function UrgenciaBadge({ dias, sinSeguimiento }: { dias: number | null; sinSeguimiento: boolean }) {
  if (sinSeguimiento) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        Sin contacto
      </span>
    );
  }
  if (dias === null) return null;
  if (dias >= 30) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        {dias}d sin contacto
      </span>
    );
  }
  if (dias >= DIAS_UMBRAL) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        {dias}d sin contacto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      Contactado hace {dias}d
    </span>
  );
}

export default async function SeguimientosPage({ searchParams }: SeguimientosPageProps) {
  const params = await searchParams;
  const anio = params.anio ? Number.parseInt(params.anio, 10) : 2026;
  const nivel = params.nivel ?? undefined;
  const estado = params.estado ?? undefined;
  const soloUrgentes = params.urgente === "1";

  const prospectos = await prisma.prospecto.findMany({
    where: {
      anioProceso: anio,
      ...(nivel ? { nivel } : {}),
      ...(estado ? { estadoProcesoCat: estado } : { estadoProcesoCat: { notIn: ESTADOS_PERDIDOS } }),
    },
    select: {
      id: true,
      nivel: true,
      gradoPrimario: true,
      estadoProcesoCat: true,
      flagOk: true,
      asesor: true,
      canalLlegada: true,
      mesCita: true,
      contactoMejoresColegios: true,
      estudiante: { select: { nombreCompleto: true } },
      citasInformacion: {
        select: { fecha: true, asistio: true },
        orderBy: { fecha: "asc" },
        take: 1
      },
      seguimientos: {
        select: { fecha: true, medio: true, observacion: true, numeroContacto: true },
        orderBy: { fecha: "desc" },
        take: 3
      },
      etapas: {
        select: { etapa: true, completada: true }
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  const ahora = new Date();

  const procesados = prospectos.map((p) => {
    const ultimoSeg = p.seguimientos[0]?.fecha ?? null;
    const diasSinContacto = ultimoSeg
      ? Math.floor((ahora.getTime() - new Date(ultimoSeg).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const sinSeguimiento = p.seguimientos.length === 0;
    const urgente = sinSeguimiento || (diasSinContacto !== null && diasSinContacto >= DIAS_UMBRAL);
    const etapasCompletas = p.etapas.filter((e) => e.completada).map((e) => e.etapa);

    return { ...p, diasSinContacto, sinSeguimiento, urgente, etapasCompletas };
  });

  const filtrados = soloUrgentes ? procesados.filter((p) => p.urgente) : procesados;

  // Ordenar: sin seguimiento primero, luego más días sin contacto
  filtrados.sort((a, b) => {
    if (a.sinSeguimiento !== b.sinSeguimiento) return a.sinSeguimiento ? -1 : 1;
    const da = a.diasSinContacto ?? 9999;
    const db = b.diasSinContacto ?? 9999;
    return db - da;
  });

  const totalSinSeg = filtrados.filter((p) => p.sinSeguimiento).length;
  const totalUrgentes = filtrados.filter((p) => p.urgente).length;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-fontan-blue">CRM</p>
          <h1 className="mt-1 text-2xl font-bold text-fontan-ink">Seguimientos pendientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Prospectos activos que requieren contacto. Umbral: {DIAS_UMBRAL} días sin respuesta.
          </p>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total activos</p>
          <p className="mt-2 text-3xl font-bold text-fontan-ink">{formatNumber(filtrados.length)}</p>
          <p className="text-xs text-slate-400">Año {anio}</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${totalSinSeg > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sin seguimiento</p>
          <p className={`mt-2 text-3xl font-bold ${totalSinSeg > 0 ? "text-red-600" : "text-fontan-ink"}`}>
            {formatNumber(totalSinSeg)}
          </p>
          <p className="text-xs text-slate-400">Nunca contactados</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${totalUrgentes > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Urgentes</p>
          <p className={`mt-2 text-3xl font-bold ${totalUrgentes > 0 ? "text-amber-600" : "text-fontan-ink"}`}>
            {formatNumber(totalUrgentes)}
          </p>
          <p className="text-xs text-slate-400">{DIAS_UMBRAL}+ días sin contacto</p>
        </div>
      </div>

      {/* Filtros */}
      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-5">
        <input
          name="anio"
          type="number"
          defaultValue={anio}
          placeholder="Año"
          className={inputClass}
        />
        <select name="nivel" defaultValue={nivel ?? ""} className={inputClass}>
          <option value="">Todos los niveles</option>
          {NIVELES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select name="estado" defaultValue={estado ?? ""} className={inputClass}>
          <option value="">Todos los estados activos</option>
          {ESTADOS_ACTIVOS.map((e) => (
            <option key={e} value={e}>{e.replace(/_/g, " ")}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" name="urgente" value="1" defaultChecked={soloUrgentes} />
          Solo urgentes
        </label>
        <button className="rounded-full bg-fontan-blue px-4 py-2 text-sm font-semibold text-white">
          Filtrar
        </button>
      </form>

      {/* Lista de prospectos */}
      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-400">No hay prospectos que requieran seguimiento con los filtros actuales.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition-colors ${
                p.sinSeguimiento
                  ? "border-red-200"
                  : p.urgente
                  ? "border-amber-200"
                  : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/prospectos/${p.id}`}
                      className="font-semibold text-fontan-ink hover:text-fontan-blue hover:underline"
                    >
                      {p.estudiante?.nombreCompleto ?? "Sin nombre"}
                    </Link>
                    <UrgenciaBadge dias={p.diasSinContacto} sinSeguimiento={p.sinSeguimiento} />
                    {p.contactoMejoresColegios && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Mejores Colegios
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {p.nivel} · {p.gradoPrimario ?? "Sin grado"} ·{" "}
                    <span className="font-medium text-slate-600">{p.estadoProcesoCat ?? "pendiente"}</span>
                    {p.asesor ? ` · Asesor: ${p.asesor}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Cita: {formatDate(p.citasInformacion[0]?.fecha)} ·{" "}
                    {p.citasInformacion[0]?.asistio ? "Asistió" : "No asistió / sin dato"} ·{" "}
                    Canal: {p.canalLlegada ?? "—"} ·{" "}
                    CRM: {p.flagOk ?? "—"}
                  </p>
                </div>

                {/* Etapas completadas */}
                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-1">
                    {["INICIO_PROCESO", "PRUEBAS", "OBSERVACION", "MATRICULA"].map((etapa) => (
                      <div
                        key={etapa}
                        title={etapa.replace(/_/g, " ")}
                        className={`h-2 w-8 rounded-full ${
                          p.etapasCompletas.includes(etapa) ? "bg-fontan-blue" : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    {p.etapasCompletas.length}/4 etapas
                  </p>
                </div>
              </div>

              {/* Últimos seguimientos */}
              {p.seguimientos.length > 0 ? (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="space-y-1">
                    {[...p.seguimientos].reverse().map((seg) => (
                      <div key={`${seg.fecha}-${seg.numeroContacto}`} className="flex gap-3 text-xs text-slate-500">
                        <span className="flex-shrink-0 font-medium text-slate-600">
                          Contacto {seg.numeroContacto} · {formatDate(seg.fecha)}
                        </span>
                        {seg.medio ? <span>via {seg.medio}</span> : null}
                        {seg.observacion ? (
                          <span className="truncate text-slate-400">{seg.observacion}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-red-500 border-t border-red-100 pt-3">
                  Nunca se ha registrado un seguimiento para este prospecto.
                </p>
              )}

              {/* Botón acción */}
              <div className="mt-3 flex justify-end">
                <Link
                  href={`/prospectos/${p.id}`}
                  className="rounded-full border border-fontan-blue px-3 py-1 text-xs font-semibold text-fontan-blue hover:bg-fontan-blue hover:text-white transition-colors"
                >
                  Registrar contacto →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
