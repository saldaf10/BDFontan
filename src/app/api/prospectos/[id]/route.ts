import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const prospecto = await prisma.prospecto.findUnique({
    where: { id },
    include: {
      estudiante: true,
      citasInformacion: true,
      etapas: true,
      seguimientos: true
    }
  });

  if (!prospecto) {
    return NextResponse.json({ error: "Prospecto no encontrado" }, { status: 404 });
  }

  return NextResponse.json(prospecto);
}
