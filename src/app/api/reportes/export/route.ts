import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const anio = params.get("anio") ? Number.parseInt(params.get("anio") ?? "", 10) : undefined;
  const where = {
    ...(anio ? { anioProceso: anio } : {}),
    ...(params.get("nivel") ? { nivel: params.get("nivel") ?? undefined } : {}),
    ...(params.get("asesor")
      ? { asesor: { contains: params.get("asesor") ?? "", mode: "insensitive" as const } }
      : {}),
    ...(params.get("estado") ? { estadoProcesoCat: params.get("estado") ?? undefined } : {}),
    ...(params.get("canal") ? { canalLlegada: params.get("canal") ?? undefined } : {})
  };

  const prospectos = await prisma.prospecto.findMany({
    where,
    include: {
      estudiante: true,
      citasInformacion: { orderBy: { fecha: "asc" }, take: 1 },
      etapas: true
    },
    orderBy: [{ anioProceso: "desc" }, { createdAt: "desc" }],
    take: 10000
  });

  const header = [
    "id",
    "nombre_estudiante",
    "anio",
    "nivel",
    "grado",
    "asesor",
    "canal",
    "estado",
    "fecha_cita",
    "inicio_proceso",
    "pruebas",
    "observacion",
    "matricula"
  ];

  const rows = prospectos.map((prospecto) => {
    const stage = (name: string) =>
      prospecto.etapas.find((etapa) => etapa.etapa === name && etapa.completada)?.fecha?.toISOString().slice(0, 10) ?? "";
    return [
      prospecto.id,
      prospecto.estudiante?.nombreCompleto,
      prospecto.anioProceso,
      prospecto.nivel,
      prospecto.gradoPrimario,
      prospecto.asesor,
      prospecto.canalLlegada,
      prospecto.estadoProcesoCat,
      prospecto.citasInformacion[0]?.fecha?.toISOString().slice(0, 10),
      stage("INICIO_PROCESO"),
      stage("PRUEBAS"),
      stage("OBSERVACION"),
      stage("MATRICULA")
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=reportes-fontan.csv"
    }
  });
}
