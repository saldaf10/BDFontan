/**
 * Embudo lógico: si una familia avanzó a una etapa posterior, cuenta también
 * en las anteriores (p. ej. matrícula implica inicio, pruebas y observación),
 * aunque en el Excel no estuviera marcada explícitamente “Inicio proceso”.
 */

export type CumulativeFunnelCounts = {
  inicio: number;
  pruebas: number;
  observacion: number;
  matricula: number;
};

export function nivelKey(nivel: string | null | undefined): string {
  return nivel ?? "SIN_NIVEL";
}

export type CumulativeFunnelFlags = {
  inicio: boolean;
  pruebas: boolean;
  observacion: boolean;
  matricula: boolean;
};

/** Etapas completadas de un prospecto → qué barras del embudo le corresponden (lógica acumulativa). */
export function cumulativeFlagsFromCompletedStages(etapasCompletadas: Set<string>): CumulativeFunnelFlags {
  const h = (e: string) => etapasCompletadas.has(e);
  return {
    inicio: h("INICIO_PROCESO") || h("PRUEBAS") || h("OBSERVACION") || h("MATRICULA"),
    pruebas: h("PRUEBAS") || h("OBSERVACION") || h("MATRICULA"),
    observacion: h("OBSERVACION") || h("MATRICULA"),
    matricula: h("MATRICULA")
  };
}

export function stagesSetFromRows(
  etapas: ReadonlyArray<{ etapa: string; completada: boolean }>
): Set<string> {
  const s = new Set<string>();
  for (const e of etapas) {
    if (e.completada) s.add(e.etapa);
  }
  return s;
}

/** Lista plana de etapas completadas (BD) → totales globales acumulativos. */
export function aggregateGlobalCumulative(
  rows: ReadonlyArray<{ idProspecto: string; etapa: string }>
): CumulativeFunnelCounts {
  const byProspect = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!byProspect.has(r.idProspecto)) byProspect.set(r.idProspecto, new Set());
    byProspect.get(r.idProspecto)!.add(r.etapa);
  }
  const totals: CumulativeFunnelCounts = { inicio: 0, pruebas: 0, observacion: 0, matricula: 0 };
  for (const set of byProspect.values()) {
    const f = cumulativeFlagsFromCompletedStages(set);
    if (f.inicio) totals.inicio++;
    if (f.pruebas) totals.pruebas++;
    if (f.observacion) totals.observacion++;
    if (f.matricula) totals.matricula++;
  }
  return totals;
}

/** Misma lógica agrupada por clave (año|nivel). */
export function aggregateCumulativeByGroupKey(
  rows: ReadonlyArray<{ idProspecto: string; etapa: string; groupKey: string }>
): Map<string, CumulativeFunnelCounts> {
  const byGroup = new Map<string, Map<string, Set<string>>>();

  for (const r of rows) {
    if (!byGroup.has(r.groupKey)) byGroup.set(r.groupKey, new Map());
    const pmap = byGroup.get(r.groupKey)!;
    if (!pmap.has(r.idProspecto)) pmap.set(r.idProspecto, new Set());
    pmap.get(r.idProspecto)!.add(r.etapa);
  }

  const out = new Map<string, CumulativeFunnelCounts>();
  for (const [gKey, pmap] of byGroup) {
    const totals: CumulativeFunnelCounts = { inicio: 0, pruebas: 0, observacion: 0, matricula: 0 };
    for (const set of pmap.values()) {
      const f = cumulativeFlagsFromCompletedStages(set);
      if (f.inicio) totals.inicio++;
      if (f.pruebas) totals.pruebas++;
      if (f.observacion) totals.observacion++;
      if (f.matricula) totals.matricula++;
    }
    out.set(gKey, totals);
  }
  return out;
}
