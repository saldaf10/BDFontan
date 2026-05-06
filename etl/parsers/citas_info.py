from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from etl.normalizers.canal_llegada import normalizar_canal_llegada
from etl.normalizers.estado_proceso import normalizar_estado_proceso
from etl.normalizers.grados import inferir_nivel, normalizar_grado
from etl.normalizers.text import canonical, clean_text, to_bool_si_no, to_date


INFO_SHEETS = {
    "Primaria - Preescolar": None,
    "Bachillerato": "BACHILLERATO"
}

SEGUIMIENTO_SHEETS = {
    "Seguimiento Preescolar": "PREESCOLAR",
    "Seguimiento Primaria": "PRIMARIA",
    "Seguimiento Bachillerato": "BACHILLERATO"
}


def parsear_citas_info(filepath: Path) -> dict[str, list[dict[str, Any]]]:
    prospectos: list[dict[str, Any]] = []
    seguimientos: list[dict[str, Any]] = []
    for sheet_name, nivel in INFO_SHEETS.items():
        prospectos.extend(parsear_info_sheet(filepath, sheet_name, nivel))
    for sheet_name, nivel in SEGUIMIENTO_SHEETS.items():
        seguimientos.extend(parsear_seguimiento_sheet(filepath, sheet_name, nivel))
    return {"prospectos": prospectos, "seguimientos": seguimientos}


def parsear_info_sheet(filepath: Path, sheet_name: str, nivel: str | None) -> list[dict[str, Any]]:
    df = pd.read_excel(filepath, sheet_name=sheet_name, header=0).dropna(how="all")
    records: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        nombre = clean_text(row.get("Nombre Estudiante"))
        if not nombre:
            continue
        grado = normalizar_grado(row.get("Grado"))
        canal_source = _canal_source(row, sheet_name)
        canal = normalizar_canal_llegada(canal_source)
        cita_fecha = to_date(row.get("Fecha"))
        estado_original = clean_text(row.get("Observaciones"))

        records.append({
            "estudiante": {
                "nombre_completo": nombre,
                "grado": grado.primario,
                "nivel": inferir_nivel(grado.primario, nivel),
                "origen_archivo": f"citas_info:{sheet_name}"
            },
            "acudiente": {
                "nombre_completo": clean_text(row.get("Nombre de acudiente")),
                "telefono": clean_text(row.get("Contacto")),
                "email": clean_text(row.get("Correo"))
            },
            "prospecto": {
                "anio_proceso": 2026,
                "canal_llegada": canal.categoria,
                "canal_llegada_original": canal.original,
                "referido_nombre": canal.referido_nombre,
                "grado_primario": grado.primario,
                "grado_secundario": grado.secundario,
                "nivel": inferir_nivel(grado.primario, nivel),
                "estado_proceso_cat": normalizar_estado_proceso(estado_original),
                "estado_proceso_original": estado_original,
                "observaciones": _clean_observaciones(row.get("Observaciones")),
                "flag_ok": clean_text(row.get("Unnamed: 0")),
                "contacto_mejores_colegios": bool(to_bool_si_no(row.get("Contacto desde los mejores colegios"))),
                "mes_cita": clean_text(row.get("Mes fecha de info")),
                "origen_archivo": f"citas_info:{sheet_name}"
            },
            "cita_informacion": {
                "fecha": cita_fecha,
                "asistio": to_bool_si_no(row.get("Asistió")),
                "tipo_contacto": _tipo_contacto(row, sheet_name),
                "observaciones": _clean_observaciones(row.get("Observaciones"))
            }
        })
    return records


def parsear_seguimiento_sheet(filepath: Path, sheet_name: str, nivel: str) -> list[dict[str, Any]]:
    raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
    columns = _combined_columns(raw.iloc[0].tolist(), raw.iloc[1].tolist())
    df = raw.iloc[2:].copy()
    df.columns = columns
    df = df.dropna(how="all")

    records: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        nombre = clean_text(row.get("nombre_del_estudiante"))
        if not nombre:
            continue
        grado = normalizar_grado(row.get("grado"))
        base = {
            "estudiante_key": f"{canonical(nombre)}|{grado.primario or ''}",
            "nombre_estudiante": nombre,
            "grado": grado.primario,
            "nivel": inferir_nivel(grado.primario, nivel),
            "fecha_cita": to_date(row.get("fecha_cita")),
            "acudiente": clean_text(row.get("acudiente")),
            "telefono": clean_text(row.get("telefono_de_contacto")),
            "fecha_nacimiento": to_date(row.get("fecha_de_nacimiento")),
            "edad": row.get("edad") if pd.notna(row.get("edad")) else None,
            "estado_proceso": clean_text(row.get("estado_del_proceso")),
            "origen_archivo": f"citas_info:{sheet_name}"
        }
        for numero in [1, 2, 3]:
            if any(clean_text(row.get(f"contacto{numero}_{field}")) for field in ["fecha", "medio", "observacion"]):
                records.append({
                    **base,
                    "numero_contacto": numero,
                    "fecha": to_date(row.get(f"contacto{numero}_fecha")),
                    "medio": clean_text(row.get(f"contacto{numero}_medio")),
                    "observacion": clean_text(row.get(f"contacto{numero}_observacion"))
                })
    return records


def _combined_columns(row0: list[Any], row1: list[Any]) -> list[str]:
    columns: list[str] = []
    current_group: str | None = None
    for index, (top, bottom) in enumerate(zip(row0, row1)):
        top_text = clean_text(top)
        bottom_text = clean_text(bottom)
        if top_text:
            current_group = top_text
        if current_group in {"Contacto 1", "Contacto 2 recepción", "Contacto 3"}:
            numero = "1" if "1" in current_group else "2" if "2" in current_group else "3"
            columns.append(f"contacto{numero}_{_slug(bottom_text or 'unknown')}")
        elif top_text:
            columns.append(_slug(top_text))
        else:
            columns.append(f"col_{index}")
    return columns


def _slug(value: str) -> str:
    return canonical(value).lower().replace(" ", "_")


def _canal_source(row: pd.Series, sheet_name: str) -> Any:
    # "Como llegó al colegio?" es siempre la fuente primaria.
    # En Bachillerato, si ese campo está vacío, usar "Tipo de Contacto" como fallback
    # porque en ese sheet a veces contiene el canal real (ej: "por recomendación").
    primary = clean_text(row.get("Como llegó al colegio?"))
    if primary:
        return primary
    if sheet_name == "Bachillerato":
        return row.get("Tipo de Contacto")
    return None


def _tipo_contacto(row: pd.Series, sheet_name: str) -> str | None:
    if sheet_name == "Bachillerato":
        return None
    return clean_text(row.get("Tipo de Contacto"))


def _clean_observaciones(value: Any) -> str | None:
    text = clean_text(value)
    if text == "2026":
        return None
    return text
