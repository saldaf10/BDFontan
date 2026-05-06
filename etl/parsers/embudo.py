from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from etl.normalizers.canal_llegada import normalizar_canal_llegada
from etl.normalizers.estado_proceso import normalizar_estado_proceso
from etl.normalizers.grados import inferir_nivel, normalizar_grado
from etl.normalizers.text import clean_text, to_bool_si_no, to_date


DATA_SHEETS = {
    "Datos Preescolar": "PREESCOLAR",
    "Datos Primaria": "PRIMARIA",
    "Datos Bachillerato": "BACHILLERATO"
}


def parsear_embudo(filepath: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for sheet_name, nivel in DATA_SHEETS.items():
        records.extend(parsear_embudo_sheet(filepath, sheet_name, nivel))
    return records


def parsear_embudo_sheet(filepath: Path, sheet_name: str, nivel: str) -> list[dict[str, Any]]:
    df = pd.read_excel(filepath, sheet_name=sheet_name, header=0)
    df = _drop_report_columns(df)
    if "Unnamed: 0" in df.columns:
        df = df.drop(columns=["Unnamed: 0"])
    df = df.dropna(subset=["Estudiante"])

    records: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        grado = normalizar_grado(row.get("Grado"))
        canal = normalizar_canal_llegada(row.get("Como conoció el colegio"))
        estado_original = clean_text(row.get("Estado del proceso"))
        cita_fecha = to_date(row.get("Día"))
        inicio_fecha = to_date(row.get("Inicio proceso")) or cita_fecha if to_bool_si_no(row.get("Inicio proceso")) else to_date(row.get("Inicio proceso"))

        records.append({
            "estudiante": {
                "nombre_completo": clean_text(row.get("Estudiante")),
                "grado": grado.primario,
                "nivel": inferir_nivel(grado.primario, nivel),
                "origen_archivo": f"embudo:{sheet_name}"
            },
            "prospecto": {
                "anio_proceso": cita_fecha.year if cita_fecha else None,
                "canal_llegada": canal.categoria,
                "canal_llegada_original": canal.original,
                "referido_nombre": canal.referido_nombre,
                "grado_primario": grado.primario,
                "grado_secundario": grado.secundario,
                "nivel": inferir_nivel(grado.primario, nivel),
                "estado_proceso_cat": normalizar_estado_proceso(estado_original),
                "estado_proceso_original": estado_original,
                "observaciones": clean_text(row.get("Observaciones")),
                "mes_cita": clean_text(row.get("Mes")),
                "origen_archivo": f"embudo:{sheet_name}"
            },
            "cita_informacion": {
                "fecha": cita_fecha,
                "asistio": True,
                "observaciones": clean_text(row.get("Observaciones"))
            },
            "etapas": [
                _etapa("INICIO_PROCESO", inicio_fecha, bool(inicio_fecha or to_bool_si_no(row.get("Inicio proceso")))),
                _etapa("PRUEBAS", to_date(row.get("Pruebas")), bool(to_date(row.get("Pruebas")))),
                _etapa("OBSERVACION", to_date(row.get("Observación")), bool(to_date(row.get("Observación")))),
                _etapa("MATRICULA", to_date(row.get("Matrícula")), bool(to_date(row.get("Matrícula"))))
            ]
        })
    return records


def _drop_report_columns(df: pd.DataFrame) -> pd.DataFrame:
    valid_cols = []
    for column in df.columns:
        text = str(column)
        if isinstance(column, float):
            continue
        if text.replace(".", "", 1).isdigit():
            continue
        if text.startswith("Unnamed: 1") or text.startswith("Unnamed: 2"):
            continue
        if "Días entre" in text or "Dias entre" in text:
            continue
        valid_cols.append(column)
    return df[valid_cols]


def _etapa(etapa: str, fecha: object | None, completada: bool) -> dict[str, Any]:
    return {
        "etapa": etapa,
        "fecha": fecha,
        "completada": completada
    }
