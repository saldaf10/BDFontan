import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const estudiantes = await prisma.estudiante.findMany({
    orderBy: { nombreCompleto: "asc" },
    take: 200
  });

  return NextResponse.json(estudiantes);
}
