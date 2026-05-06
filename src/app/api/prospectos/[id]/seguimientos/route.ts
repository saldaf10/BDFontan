import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const seguimientos = await prisma.seguimiento.findMany({
    where: { idProspecto: id },
    orderBy: [{ numeroContacto: "asc" }, { fecha: "asc" }]
  });

  return NextResponse.json(seguimientos);
}
