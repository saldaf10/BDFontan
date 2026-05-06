import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { madrePadreDesdeAcudientes, nivelEtiqueta } from "@/lib/morral-family";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  const evento = await prisma.eventoInstitucional.findUnique({
    where: { id },
    select: { nombre: true, fecha: true }
  });

  if (!evento) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const rows = await prisma.asistenciaEvento.findMany({
    where: { idEvento: id },
    include: {
      estudiante: {
        include: {
          acudientes: {
            include: { acudiente: true },
            orderBy: [{ orden: "asc" }, { relacion: "asc" }]
          }
        }
      }
    },
    orderBy: [{ estudiante: { grado: "asc" } }, { estudiante: { nombreCompleto: "asc" } }]
  });

  const header = [
    "evento",
    "fecha_evento",
    "estudiante_id",
    "codigo",
    "nombre",
    "grado",
    "nivel",
    "nivel_etiqueta",
    "madre_nombre",
    "madre_email",
    "padre_nombre",
    "padre_email",
    "resultado",
    "excusa"
  ];
  const lines = [
    header,
    ...rows.map((r) => {
      const { madre, padre } = madrePadreDesdeAcudientes(r.estudiante.acudientes);
      return [
        evento.nombre,
        evento.fecha.toISOString().slice(0, 10),
        r.estudiante.id,
        r.estudiante.codigoInterno,
        r.estudiante.nombreCompleto,
        r.estudiante.grado,
        r.estudiante.nivel,
        nivelEtiqueta(r.estudiante.nivel),
        madre?.nombreCompleto ?? "",
        madre?.email ?? "",
        padre?.nombreCompleto ?? "",
        padre?.email ?? "",
        r.resultado,
        r.excusa
      ];
    })
  ];

  const csv = lines.map((line) => line.map(csvCell).join(",")).join("\n");
  const safeName = evento.nombre.slice(0, 40).replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=asistencia_${safeName}.csv`
    }
  });
}
