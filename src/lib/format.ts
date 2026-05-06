export function formatNumber(value: number | bigint | null | undefined): string {
  if (value === null || value === undefined) {
    return "0";
  }
  return Number(value).toLocaleString("es-CO");
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return "Sin fecha";
  }
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(value));
}
