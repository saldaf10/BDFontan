from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from etl.normalizers.canal_llegada import normalizar_canal_llegada
from etl.normalizers.estado_proceso import normalizar_estado_proceso
from etl.normalizers.grados import inferir_nivel, normalizar_grado
from etl.normalizers.text import clean_text, to_bool_si_no, to_date


ASESORES = {
    "Bachillerato Adriana": "Adriana",
    "Bachillerato Eliana": "Eliana",
    "Bachillerato Rosita": "Rosita"
}


def parsear_citas_individuales(filepath: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for sheet_name in pd.ExcelFile(filepath).sheet_names:
        records.extend(parsear_citas_individuales_sheet(filepath, sheet_name))
    return records


def parsear_citas_individuales_sheet(filepath: Path, sheet_name: str) -> list[dict[str, Any]]:
    df = pd.read_excel(filepath, sheet_name=sheet_name, header=0).dropna(how="all")
    asesor = ASESORES.get(sheet_name)
    nivel = "PREESCOLAR" if "Preescolar" in sheet_name else "BACHILLERATO"
    records: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        nombre = clean_text(row.get("Estudiante"))
        if not nombre:
            continue
        grado = normalizar_grado(row.get("Grado"))
        canal = normalizar_canal_llegada(row.get("Como conoció el colegio"))
        cita_fecha = to_date(row.get("Día"))
        estado_original = clean_text(row.get("Estado del proceso"))
        observaciones = " | ".join(filter(None, [
            clean_text(row.get("Observación")),
            clean_text(row.get("Observaciones"))
        ])) or None

        records.append({
            "estudiante": {
                "nombre_completo": nombre,
                "grado": grado.primario,
                "nivel": inferir_nivel(grado.primario, nivel),
                "origen_archivo": f"citas_individuales:{sheet_name}"
            },
            "prospecto": {
                "anio_proceso": 2025,
                "canal_llegada": canal.categoria,
                "canal_llegada_original": canal.original,
                "referido_nombre": canal.referido_nombre,
                "asesor": asesor,
                "grado_primario": grado.primario,
                "grado_secundario": grado.secundario,
                "nivel": inferir_nivel(grado.primario, nivel),
                "estado_proceso_cat": normalizar_estado_proceso(estado_original),
                "estado_proceso_original": estado_original,
                "observaciones": observaciones,
                "mes_cita": clean_text(row.get("Mes")),
                "origen_archivo": f"citas_individuales:{sheet_name}"
            },
            "cita_informacion": {
                "fecha": cita_fecha,
                "asistio": True,
                "observaciones": observaciones
            },
            "etapas": [
                _etapa_from_value("INICIO_PROCESO", row.get("Inicio proceso"), cita_fecha),
                _etapa_from_value("PRUEBAS", row.get("Pruebas")),
                _etapa_from_value("OBSERVACION", row.get("Observación")),
                _etapa_from_value("MATRICULA", row.get("Matrícula"))
            ]
        })
    return records


def _etapa_from_value(etapa: str, value: Any, fallback_date: object | None = None) -> dict[str, Any]:
    date_value = to_date(value)
    bool_value = to_bool_si_no(value)
    return {
        "etapa": etapa,
        "fecha": date_value or (fallback_date if bool_value else None),
        "completada": bool(date_value or bool_value),
        "admitido": bool_value if etapa in {"OBSERVACION", "MATRICULA"} else None
    }
