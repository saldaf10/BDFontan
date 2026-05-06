/**
 * GET /api/reportes/dias-etapas?anio=2024&nivel=BACHILLERATO
 *
 * Calcula el promedio de días entre cada etapa del proceso de admisión.
 * Devuelve datos por año y nivel para comparar eficiencia del proceso.
 *
 * Métricas:
 * - dias_cita_a_inicio   : desde cita_informacion.fecha hasta INICIO_PROCESO
 * - dias_inicio_a_pruebas: desde INICIO_PROCESO hasta PRUEBAS (solo Primaria/Bachillerato)
 * - dias_pruebas_a_obs   : desde PRUEBAS hasta OBSERVACION
 * - dias_obs_a_matricula : desde OBSERVACION hasta MATRICULA
 * - dias_cita_a_matricula: total desde cita hasta matrícula
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  const diff = b.getTime() - a.getTime();
  if (diff < 0) return null; // fechas invertidas (error de datos)
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

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
      anioProceso: true,
      nivel: true,
      citasInformacion: {
        select: { fecha: true },
        orderBy: { fecha: "asc" },
        take: 1
      },
      etapas: {
        select: { etapa: true, fecha: true, completada: true }
      }
    }
  });

  type Grupo = {
    diasCitaAInicio: number[];
    diasInicioAPruebas: number[];
    diasPruebasAObs: number[];
    diasObsAMatricula: number[];
    diasCitaAMatricula: number[];
  };

  const grupos = new Map<string, Grupo>();
  const getGrupo = (key: string) => {
    if (!grupos.has(key)) {
      grupos.set(key, {
        diasCitaAInicio: [],
        diasInicioAPruebas: [],
        diasPruebasAObs: [],
        diasObsAMatricula: [],
        diasCitaAMatricula: []
      });
    }
    return grupos.get(key)!;
  };

  for (const p of prospectos) {
    const key = `${p.anioProceso}|${p.nivel ?? "SIN_NIVEL"}`;
    const grupo = getGrupo(key);

    const fechaCita = p.citasInformacion[0]?.fecha ?? null;
    const etapaMap = new Map(
      p.etapas
        .filter((e) => e.completada && e.fecha)
        .map((e) => [e.etapa, e.fecha as Date])
    );

    const inicio = etapaMap.get("INICIO_PROCESO") ?? null;
    const pruebas = etapaMap.get("PRUEBAS") ?? null;
    const obs = etapaMap.get("OBSERVACION") ?? null;
    const matricula = etapaMap.get("MATRICULA") ?? null;

    const d1 = daysBetween(fechaCita, inicio);
    if (d1 !== null) grupo.diasCitaAInicio.push(d1);

    const d2 = daysBetween(inicio, pruebas);
    if (d2 !== null) grupo.diasInicioAPruebas.push(d2);

    const d3 = daysBetween(pruebas, obs);
    if (d3 !== null) grupo.diasPruebasAObs.push(d3);

    const d4 = daysBetween(obs, matricula);
    if (d4 !== null) grupo.diasObsAMatricula.push(d4);

    const d5 = daysBetween(fechaCita, matricula);
    if (d5 !== null) grupo.diasCitaAMatricula.push(d5);
  }

  const rows = [...grupos.entries()].map(([key, g]) => {
    const [anioStr, nivelStr] = key.split("|");
    return {
      anio: Number.parseInt(anioStr),
      nivel: nivelStr,
      n_cita_a_inicio: g.diasCitaAInicio.length,
      n_cita_a_matricula: g.diasCitaAMatricula.length,
      avg_dias_cita_a_inicio: avg(g.diasCitaAInicio),
      avg_dias_inicio_a_pruebas: avg(g.diasInicioAPruebas),
      avg_dias_pruebas_a_obs: avg(g.diasPruebasAObs),
      avg_dias_obs_a_matricula: avg(g.diasObsAMatricula),
      avg_dias_cita_a_matricula: avg(g.diasCitaAMatricula)
    };
  }).sort((a, b) => a.anio - b.anio || (a.nivel ?? "").localeCompare(b.nivel ?? ""));

  return NextResponse.json(rows);
}
