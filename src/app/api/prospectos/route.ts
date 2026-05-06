import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const prospectos = await prisma.prospecto.findMany({
    include: {
      estudiante: true,
      citasInformacion: { orderBy: { fecha: "asc" }, take: 1 }
    },
    orderBy: [{ anioProceso: "desc" }, { createdAt: "desc" }],
    take: 100
  });

  return NextResponse.json(prospectos);
}
