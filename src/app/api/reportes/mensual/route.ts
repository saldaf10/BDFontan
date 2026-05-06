/**
 * GET /api/reportes/mensual?anio=2024&nivel=BACHILLERATO
 *
 * Devuelve el conteo de citas de información agrupadas por mes,
 * junto con cuántas llegaron a matrícula, para analizar estacionalidad.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const anio = params.get("anio") ? Number.parseInt(params.get("anio") ?? "", 10) : undefined;
  const nivel = params.get("nivel") ?? undefined;

  const where = {
    ...(anio ? { anioProceso: anio } : {}),
    ...(nivel ? { nivel } : {})
  };

  const prospectos = await prisma.prospecto.findMany({
    where,
    select: {
      mesCita: true,
      anioProceso: true,
      etapas: {
        select: { etapa: true, completada: true }
      }
    }
  });

  // Mapa mes → { total, matriculados }
  type MesData = { mes: string; orden: number; total: number; matriculados: number };
  const mesMap = new Map<string, MesData>();

  for (const p of prospectos) {
    const mes = p.mesCita ?? "Sin mes";
    const orden = MESES.indexOf(mes) >= 0 ? MESES.indexOf(mes) : 99;
    if (!mesMap.has(mes)) {
      mesMap.set(mes, { mes, orden, total: 0, matriculados: 0 });
    }
    const entry = mesMap.get(mes)!;
    entry.total++;
    if (p.etapas.some((e) => e.etapa === "MATRICULA" && e.completada)) {
      entry.matriculados++;
    }
  }

  const rows = [...mesMap.values()]
    .sort((a, b) => a.orden - b.orden)
    .map(({ mes, total, matriculados }) => ({
      mes,
      total,
      matriculados,
      tasa_conversion: total > 0 ? Math.round((matriculados / total) * 1000) / 10 : 0
    }));

  return NextResponse.json({ anio, nivel, rows });
}
