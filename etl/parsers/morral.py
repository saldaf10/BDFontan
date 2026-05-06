from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

from etl.normalizers.grados import inferir_nivel, normalizar_grado
from etl.normalizers.text import canonical, clean_text, to_date


@dataclass(frozen=True)
class MorralEvento:
    nombre: str
    fecha: object | None
    columna_inicio: int
    tipo: str | None
    nivel: str
    anio_escolar: str


def parsear_morral(filepath: Path) -> dict[str, Any]:
    sheets = [
        sheet
        for sheet in pd.ExcelFile(filepath).sheet_names
        if any(token in canonical(sheet) for token in ["PREESCOLAR", "PRIMARIA", "BACHILLERATO"])
    ]
    return {sheet: parsear_morral_sheet(filepath, sheet) for sheet in sheets}


def parsear_morral_sheet(filepath: Path, sheet_name: str) -> dict[str, Any]:
    raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
    header_row = _find_header_row(raw)
    event_row = _find_event_row(raw, header_row)
    nivel = _nivel_from_sheet(sheet_name)
    anio_escolar = "2026" if "2026" in sheet_name else "24-25"
    events = _extract_events(raw.iloc[event_row], nivel, anio_escolar)

    df = pd.read_excel(filepath, sheet_name=sheet_name, header=header_row).dropna(how="all")
    estudiantes = []
    asistencias = []

    for _, row in df.iterrows():
        nombre = clean_text(row.get("Nombre Completo"))
        if not nombre:
            continue
        grado = normalizar_grado(row.get("Grado"))
        estudiante = {
            "codigo_interno": clean_text(row.get("Código")) or clean_text(row.get("Codigo")),
            "nombre_completo": nombre,
            "grado": grado.primario,
            "nivel": inferir_nivel(grado.primario, nivel),
            "anio_ingreso": 2026 if anio_escolar == "2026" else 2024,
            "origen_archivo": f"morral:{sheet_name}",
            "madre": clean_text(row.get("Nombre de la Madre")),
            "email_madre": clean_text(row.get("Email Madre")),
            "padre": clean_text(row.get("Nombre del Padre")),
            "email_padre": clean_text(row.get("Email Padre"))
        }
        estudiantes.append(estudiante)

        for event in events:
            resultado = _resultado_evento(row, event.columna_inicio)
            asistencias.append({
                "estudiante_key": f"{canonical(nombre)}|{grado.primario or ''}",
                "evento": event,
                "resultado": resultado
            })

    return {"eventos": events, "estudiantes": estudiantes, "asistencias": asistencias}


def _find_header_row(raw: pd.DataFrame) -> int:
    for i, row in raw.iterrows():
        values = {canonical(value) for value in row.tolist()}
        if "GRADO" in values and "NOMBRE COMPLETO" in values:
            return int(i)
    raise ValueError("Could not find Morral header row")


def _find_event_row(raw: pd.DataFrame, header_row: int) -> int:
    for row_index in range(header_row - 1, -1, -1):
        values = [clean_text(value) for value in raw.iloc[row_index].tolist()[7:]]
        values = [value for value in values if value]
        if values and any(to_date(value) for value in values):
            return row_index
    return header_row - 1


def _extract_events(event_row: pd.Series, nivel: str, anio_escolar: str) -> list[MorralEvento]:
    events: list[MorralEvento] = []
    for column_index, value in enumerate(event_row.tolist()):
        text = clean_text(value)
        if not text or column_index < 7:
            continue
        event_date = to_date(text)
        if not event_date and anio_escolar == "2026" and nivel == "PRIMARIA":
            text = "14/02/2026 (Pongase el morral)"
            event_date = date(2026, 2, 14)
        events.append(MorralEvento(
            nombre=text,
            fecha=event_date,
            columna_inicio=column_index,
            tipo=_tipo_evento(text),
            nivel=nivel,
            anio_escolar=anio_escolar
        ))
    return events


def _resultado_evento(row: pd.Series, column_index: int) -> str:
    values = [_cell_by_position(row, idx) for idx in range(column_index, column_index + 3)]
    labels = ["SI", "NO", "EXCUSA"]
    for label, value in zip(labels, values):
        if canonical(value) in {"SI", "X", "1", label}:
            return label
    return "NO"


def _cell_by_position(row: pd.Series, index: int) -> Any:
    if index >= len(row.index):
        return None
    return row.iloc[index]


def _nivel_from_sheet(sheet_name: str) -> str:
    text = canonical(sheet_name)
    if "PREESCOLAR" in text:
        return "PREESCOLAR"
    if "PRIMARIA" in text:
        return "PRIMARIA"
    return "BACHILLERATO"


def _tipo_evento(nombre: str) -> str:
    text = canonical(nombre)
    if "MORRAL" in text:
        return "PONGASE_EL_MORRAL"
    if "ASAMBLEA" in text:
        return "ASAMBLEA"
    if "NUEVOS Y ANTIGUOS" in text:
        return "CHARLA_VIRTUAL_TODOS"
    if "NUEVOS" in text:
        return "CHARLA_VIRTUAL_NUEVOS"
    if "ANTIGUOS" in text:
        return "CHARLA_VIRTUAL_ANTIGUOS"
    return "OTRO"
