/**
 * GET /api/reportes/pendientes?anio=2026&nivel=BACHILLERATO
 *
 * Lista prospectos que requieren seguimiento activo:
 * - Sin ningún seguimiento registrado
 * - Último seguimiento hace más de 14 días
 * - Estado "pendiente" o "pensando"
 *
 * Devuelve los prospectos ordenados por urgencia (sin seguimiento primero,
 * luego por fecha del último contacto, más antiguo primero).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DIAS_SIN_CONTACTO = 14;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const anio = params.get("anio") ? Number.parseInt(params.get("anio") ?? "", 10) : 2026;
  const nivel = params.get("nivel") ?? undefined;

  const prospectos = await prisma.prospecto.findMany({
    where: {
      anioProceso: anio,
      ...(nivel ? { nivel } : {}),
      // Solo estados que todavía pueden convertir
      estadoProcesoCat: {
        notIn: ["matriculado", "no_admitido", "desiste", "no_continua_costos", "otro_colegio", "edad_insuficiente", "necesidades_especiales"]
      }
    },
    select: {
      id: true,
      nivel: true,
      gradoPrimario: true,
      estadoProcesoCat: true,
      flagOk: true,
      estudiante: { select: { nombreCompleto: true } },
      citasInformacion: {
        select: { fecha: true, asistio: true },
        orderBy: { fecha: "asc" },
        take: 1
      },
      seguimientos: {
        select: { fecha: true, medio: true },
        orderBy: { fecha: "desc" },
        take: 1
      },
      etapas: {
        select: { etapa: true, completada: true }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const ahora = new Date();

  const resultado = prospectos.map((p) => {
    const ultimoSeguimiento = p.seguimientos[0]?.fecha ?? null;
    const diasDesdeContacto = ultimoSeguimiento
      ? Math.floor((ahora.getTime() - new Date(ultimoSeguimiento).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const sinSeguimiento = p.seguimientos.length === 0;
    const urgente = sinSeguimiento || (diasDesdeContacto !== null && diasDesdeContacto >= DIAS_SIN_CONTACTO);

    const etapasCompletas = p.etapas
      .filter((e) => e.completada)
      .map((e) => e.etapa);

    return {
      id: p.id,
      nombre: p.estudiante?.nombreCompleto ?? "Sin nombre",
      nivel: p.nivel,
      grado: p.gradoPrimario,
      estado: p.estadoProcesoCat ?? "pendiente",
      flag_ok: p.flagOk,
      fecha_cita: p.citasInformacion[0]?.fecha ?? null,
      asistio_cita: p.citasInformacion[0]?.asistio ?? null,
      ultimo_contacto: ultimoSeguimiento,
      dias_sin_contacto: diasDesdeContacto,
      sin_seguimiento: sinSeguimiento,
      urgente,
      etapas_completadas: etapasCompletas
    };
  });

  // Ordenar: sin seguimiento primero, luego por días sin contacto (más días = más urgente)
  resultado.sort((a, b) => {
    if (a.sin_seguimiento !== b.sin_seguimiento) return a.sin_seguimiento ? -1 : 1;
    const da = a.dias_sin_contacto ?? 9999;
    const db = b.dias_sin_contacto ?? 9999;
    return db - da;
  });

  return NextResponse.json({
    anio,
    nivel,
    total: resultado.length,
    sin_seguimiento: resultado.filter((r) => r.sin_seguimiento).length,
    urgentes: resultado.filter((r) => r.urgente).length,
    prospectos: resultado
  });
}
