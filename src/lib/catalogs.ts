export const NIVELES = ["PREESCOLAR", "PRIMARIA", "BACHILLERATO"] as const;

export const CANALES_LLEGADA = [
  "referido_familia",
  "referido_egresado",
  "referido_profesional",
  "referido_rector_docente",
  "internet",
  "redes_sociales",
  "pauta_digital",
  "feria",
  "crm",
  "vecinos",
  "conoce_tiempo_atras",
  "otro_colegio",
  "otros"
] as const;

export const GRADOS = [
  "PREJARDIN",
  "JARDIN",
  "TRANSICION",
  "1°",
  "2°",
  "3°",
  "4°",
  "5°",
  "6°",
  "7°",
  "8°",
  "9°",
  "10°",
  "11°",
  "MULTIPLE"
] as const;

export const ESTADOS_PROCESO = [
  "pendiente",
  "pensando",
  "matriculado",
  "no_admitido",
  "desiste",
  "no_continua_costos",
  "no_responde",
  "otro_colegio",
  "edad_insuficiente",
  "necesidades_especiales",
  "proceso_futuro"
] as const;

export const ETAPAS = ["INICIO_PROCESO", "PRUEBAS", "OBSERVACION", "MATRICULA"] as const;

export const TIPOS_EVENTO = [
  "PONGASE_EL_MORRAL",
  "ASAMBLEA",
  "CHARLA_VIRTUAL_NUEVOS",
  "CHARLA_VIRTUAL_ANTIGUOS",
  "CHARLA_VIRTUAL_TODOS",
  "OTRO"
] as const;

export const RESULTADOS_ASISTENCIA = ["SI", "NO", "EXCUSA"] as const;
