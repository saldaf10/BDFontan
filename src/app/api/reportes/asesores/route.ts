/**
 * GET /api/reportes/asesores?anio=2025
 *
 * Métricas de desempeño por asesor:
 * - total de prospectos atendidos
 * - cuántos llegaron a cada etapa
 * - tasa de conversión a matrícula
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cumulativeFlagsFromCompletedStages, stagesSetFromRows } from "@/lib/funnelLogic";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const anio = params.get("anio") ? Number.parseInt(params.get("anio") ?? "", 10) : undefined;

  const prospectos = await prisma.prospecto.findMany({
    where: {
      asesor: { not: null },
      ...(anio ? { anioProceso: anio } : {})
    },
    select: {
      asesor: true,
      anioProceso: true,
      nivel: true,
      estadoProcesoCat: true,
      etapas: {
        select: { etapa: true, completada: true }
      }
    }
  });

  type AsesorData = {
    asesor: string;
    total: number;
    inicio: number;
    pruebas: number;
    observacion: number;
    matricula: number;
    porNivel: Record<string, number>;
    porAnio: Record<string, number>;
  };

  const map = new Map<string, AsesorData>();

  for (const p of prospectos) {
    const asesor = p.asesor ?? "Sin asesor";
    if (!map.has(asesor)) {
      map.set(asesor, {
        asesor,
        total: 0,
        inicio: 0,
        pruebas: 0,
        observacion: 0,
        matricula: 0,
        porNivel: {},
        porAnio: {}
      });
    }
    const d = map.get(asesor)!;
    d.total++;

    const f = cumulativeFlagsFromCompletedStages(stagesSetFromRows(p.etapas));
    if (f.inicio) d.inicio++;
    if (f.pruebas) d.pruebas++;
    if (f.observacion) d.observacion++;
    if (f.matricula) d.matricula++;

    const nivel = p.nivel ?? "SIN_NIVEL";
    d.porNivel[nivel] = (d.porNivel[nivel] ?? 0) + 1;

    const anioKey = String(p.anioProceso);
    d.porAnio[anioKey] = (d.porAnio[anioKey] ?? 0) + 1;
  }

  const rows = [...map.values()]
    .sort((a, b) => b.total - a.total)
    .map((d) => ({
      ...d,
      tasa_matricula: d.total > 0 ? Math.round((d.matricula / d.total) * 1000) / 10 : 0,
      tasa_inicio: d.total > 0 ? Math.round((d.inicio / d.total) * 1000) / 10 : 0
    }));

  return NextResponse.json(rows);
}
