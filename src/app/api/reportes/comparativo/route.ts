/**
 * GET /api/reportes/comparativo
 *
 * Devuelve el embudo de conversión por año × nivel:
 * total citas, inicio_proceso, pruebas, observacion, matricula
 *
 * Conteos acumulativos: quien llegó a una etapa posterior cuenta también en las anteriores.
 *
 * Útil para comparar 2023 vs 2024 vs 2025 vs 2026 en el frontend.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateCumulativeByGroupKey, nivelKey } from "@/lib/funnelLogic";

export const dynamic = "force-dynamic";

export async function GET() {
  // 1. Prospectos agrupados por año + nivel (total de citas de información)
  const totalesPorAnioNivel = await prisma.prospecto.groupBy({
    by: ["anioProceso", "nivel"],
    _count: { _all: true },
    orderBy: [{ anioProceso: "asc" }, { nivel: "asc" }]
  });

  // 2. Etapas completadas → embudo lógico por año × nivel (por prospecto, luego acumulativo)
  const etapasCompletadas = await prisma.etapaProceso.findMany({
    where: { completada: true },
    select: {
      etapa: true,
      idProspecto: true,
      prospecto: {
        select: {
          anioProceso: true,
          nivel: true
        }
      }
    }
  });

  const etapaMap = aggregateCumulativeByGroupKey(
    etapasCompletadas.map((item) => ({
      idProspecto: item.idProspecto,
      etapa: item.etapa,
      groupKey: `${item.prospecto.anioProceso}|${nivelKey(item.prospecto.nivel)}`
    }))
  );

  // 3. Combinar
  const rows = totalesPorAnioNivel.map((row) => {
    const key = `${row.anioProceso}|${nivelKey(row.nivel)}`;
    const etapas = etapaMap.get(key) ?? { inicio: 0, pruebas: 0, observacion: 0, matricula: 0 };
    const total = row._count._all;
    return {
      anio: row.anioProceso,
      nivel: row.nivel,
      total_citas: total,
      inicio_proceso: etapas.inicio,
      pruebas: etapas.pruebas,
      observacion: etapas.observacion,
      matricula: etapas.matricula,
      tasa_matricula: total > 0 ? Math.round((etapas.matricula / total) * 1000) / 10 : 0
    };
  });

  return NextResponse.json(rows);
}
