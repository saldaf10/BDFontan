/**
 * GET /api/reportes/comparativo
 *
 * Devuelve el embudo de conversión por año × nivel:
 * total citas, inicio_proceso, pruebas, observacion, matricula
 *
 * Útil para comparar 2023 vs 2024 vs 2025 vs 2026 en el frontend.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  // 1. Prospectos agrupados por año + nivel (total de citas de información)
  const totalesPorAnioNivel = await prisma.prospecto.groupBy({
    by: ["anioProceso", "nivel"],
    _count: { _all: true },
    orderBy: [{ anioProceso: "asc" }, { nivel: "asc" }]
  });

  // 2. Etapas completadas por año + nivel (para contar funnel stages)
  const etapasCompletadas = await prisma.etapaProceso.findMany({
    where: { completada: true },
    select: {
      etapa: true,
      prospecto: {
        select: {
          anioProceso: true,
          nivel: true
        }
      }
    }
  });

  // 3. Construir mapa: "anio|nivel" → { inicio, pruebas, observacion, matricula }
  type EtapaMap = Record<string, { inicio: number; pruebas: number; observacion: number; matricula: number }>;
  const etapaMap: EtapaMap = {};

  for (const item of etapasCompletadas) {
    const key = `${item.prospecto.anioProceso}|${item.prospecto.nivel ?? "SIN_NIVEL"}`;
    if (!etapaMap[key]) {
      etapaMap[key] = { inicio: 0, pruebas: 0, observacion: 0, matricula: 0 };
    }
    if (item.etapa === "INICIO_PROCESO") etapaMap[key].inicio++;
    if (item.etapa === "PRUEBAS") etapaMap[key].pruebas++;
    if (item.etapa === "OBSERVACION") etapaMap[key].observacion++;
    if (item.etapa === "MATRICULA") etapaMap[key].matricula++;
  }

  // 4. Combinar
  const rows = totalesPorAnioNivel.map((row) => {
    const key = `${row.anioProceso}|${row.nivel ?? "SIN_NIVEL"}`;
    const etapas = etapaMap[key] ?? { inicio: 0, pruebas: 0, observacion: 0, matricula: 0 };
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
