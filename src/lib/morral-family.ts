type AcudienteLink = {
  relacion: string | null;
  orden: number | null;
  acudiente: {
    nombreCompleto: string;
    email: string | null;
    telefono: string | null;
  };
};

export function madrePadreDesdeAcudientes(links: AcudienteLink[]) {
  const madre =
    links.find((l) => (l.relacion ?? "").toUpperCase() === "MADRE") ??
    links.find((l) => l.orden === 1);

  const padre =
    links.find((l) => (l.relacion ?? "").toUpperCase() === "PADRE") ??
    links.find((l) => l.orden === 2);

  return {
    madre: madre?.acudiente ?? null,
    padre: padre?.acudiente ?? null
  };
}

export function nivelEtiqueta(nivel: string | null | undefined) {
  if (!nivel) return "—";
  if (nivel === "PRIMARIA") return "Primaria";
  if (nivel === "PREESCOLAR") return "Preescolar";
  if (nivel === "BACHILLERATO") return "Bachillerato";
  return nivel;
}
