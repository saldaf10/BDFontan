from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from etl.parsers.citas_individuales import parsear_citas_individuales
from etl.parsers.citas_info import parsear_citas_info
from etl.parsers.common import find_workbook
from etl.parsers.embudo import parsear_embudo
from etl.loader import load_to_postgres
from etl.parsers.morral import parsear_morral


DATA_DIRS = [ROOT_DIR / "etl" / "data", ROOT_DIR]


def main() -> None:
    parser = argparse.ArgumentParser(description="Migracion de Excel a PostgreSQL para Colegio Fontan")
    parser.add_argument("--load", action="store_true", help="Insert records into DATABASE_URL after parsing")
    parser.add_argument("--reset", action="store_true", help="Truncate migrated tables before loading")
    args = parser.parse_args()

    load_dotenv(ROOT_DIR / ".env.local", override=True)
    data_dir = _first_existing_data_dir()
    parsed = parse_all(data_dir)
    print_summary(parsed)

    if args.load:
        load_to_postgres(parsed, reset=args.reset)
        print("Carga a PostgreSQL completada")


def parse_all(data_dir: Path) -> dict[str, object]:
    morral = parsear_morral(find_workbook(data_dir, "morral"))
    embudo = parsear_embudo(find_workbook(data_dir, "embudo"))
    citas_individuales = parsear_citas_individuales(find_workbook(data_dir, "individuales"))
    citas_info = parsear_citas_info(find_workbook(data_dir, "informaci"))

    return {
        "morral": morral,
        "embudo": embudo,
        "citas_individuales": citas_individuales,
        "citas_info": citas_info
    }


def print_summary(parsed: dict[str, object]) -> None:
    morral = parsed["morral"]
    assert isinstance(morral, dict)
    morral_estudiantes = sum(len(sheet["estudiantes"]) for sheet in morral.values())
    morral_asistencias = sum(len(sheet["asistencias"]) for sheet in morral.values())
    morral_eventos = sum(len(sheet["eventos"]) for sheet in morral.values())

    embudo = parsed["embudo"]
    citas_individuales = parsed["citas_individuales"]
    citas_info = parsed["citas_info"]
    assert isinstance(embudo, list)
    assert isinstance(citas_individuales, list)
    assert isinstance(citas_info, dict)

    print("Resumen ETL")
    print(f"- Morral: {morral_estudiantes} estudiantes, {morral_eventos} eventos, {morral_asistencias} asistencias")
    print(f"- Embudo: {len(embudo)} prospectos historicos")
    print(f"- Citas individuales: {len(citas_individuales)} prospectos")
    print(f"- Citas info 2026: {len(citas_info['prospectos'])} prospectos")
    print(f"- Seguimientos 2026: {len(citas_info['seguimientos'])} contactos")


def _first_existing_data_dir() -> Path:
    for data_dir in DATA_DIRS:
        if data_dir.exists() and any(data_dir.glob("*.xlsx")):
            return data_dir
    raise FileNotFoundError("No se encontraron archivos .xlsx en etl/data ni en la raiz del proyecto")


if __name__ == "__main__":
    main()
