import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.prospecto.groupBy({
    by: ["anioProceso", "nivel"],
    _count: { _all: true },
    orderBy: [{ anioProceso: "asc" }, { nivel: "asc" }]
  });

  return NextResponse.json(rows);
}
