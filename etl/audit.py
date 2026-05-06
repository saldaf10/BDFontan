"""
etl/audit.py — Auditoría de calidad de los datos crudos en Excel.

Ejecutar:
    python etl/audit.py

No requiere conexión a base de datos. Lee los Excel directamente y reporta:
- Conteos de registros por archivo/hoja
- Porcentaje de campos críticos vacíos
- Valores únicos por campo de clasificación
- Prospectos por año detectado
- Canales de llegada más frecuentes (antes de normalizar)
- Estados del proceso más frecuentes (antes de normalizar)
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from etl.parsers.common import find_workbook
from etl.normalizers.canal_llegada import normalizar_canal_llegada
from etl.normalizers.estado_proceso import normalizar_estado_proceso
from etl.normalizers.text import clean_text

DATA_DIRS = [ROOT_DIR / "etl" / "data", ROOT_DIR]


def _first_data_dir() -> Path:
    for d in DATA_DIRS:
        if d.exists() and any(d.glob("*.xlsx")):
            return d
    raise FileNotFoundError("No se encontraron .xlsx en etl/data ni en la raíz")


def pct(n: int, total: int) -> str:
    if total == 0:
        return "0%"
    return f"{100 * n / total:.1f}%"


def sep(title: str) -> None:
    print(f"\n{'═' * 60}")
    print(f"  {title}")
    print("═" * 60)


def top(counter: Counter, n: int = 10) -> None:
    for value, count in counter.most_common(n):
        print(f"    {count:>4}  {value!r}")


def audit_morral(filepath: Path) -> None:
    sep("MORRAL — Asistencia a eventos")
    xl = pd.ExcelFile(filepath)
    for sheet in xl.sheet_names:
        df = pd.read_excel(filepath, sheet_name=sheet, header=None)
        # Encontrar fila header real
        header_row = None
        for i, row in df.iterrows():
            vals = {str(v).upper().strip() for v in row}
            if "GRADO" in vals or "NOMBRE COMPLETO" in vals:
                header_row = i
                break
        if header_row is None:
            print(f"  [{sheet}] No se encontró header")
            continue
        df_data = pd.read_excel(filepath, sheet_name=sheet, header=header_row).dropna(how="all")
        nombres = df_data.get("Nombre Completo", pd.Series(dtype=str))
        total = len(df_data)
        vacios = nombres.isna().sum() + (nombres == "").sum()
        print(f"  [{sheet}]  {total} filas  |  nombres vacíos: {vacios} ({pct(vacios, total)})")


def audit_embudo(filepath: Path) -> None:
    sep("EMBUDO — Histórico 2023-2025")
    sheets = ["Datos Preescolar", "Datos Primaria", "Datos Bachillerato"]
    canal_counter: Counter = Counter()
    estado_counter: Counter = Counter()
    anio_counter: Counter = Counter()

    for sheet in sheets:
        try:
            df = pd.read_excel(filepath, sheet_name=sheet, header=0)
        except Exception as e:
            print(f"  [{sheet}] ERROR: {e}")
            continue

        df = df.iloc[:, :16]  # ignorar columnas de cálculo
        if "Unnamed: 0" in df.columns:
            df = df.drop(columns=["Unnamed: 0"])
        df = df.dropna(subset=["Estudiante"])
        total = len(df)

        # Campos críticos vacíos
        for campo in ["Como conoció el colegio", "Estado del proceso", "Día"]:
            if campo in df.columns:
                vacios = df[campo].isna().sum()
                print(f"  [{sheet}]  {total} filas  |  '{campo}' vacío: {vacios} ({pct(vacios, total)})")

        # Contar canales y estados
        if "Como conoció el colegio" in df.columns:
            canal_counter.update(clean_text(v) for v in df["Como conoció el colegio"] if clean_text(v))
        if "Estado del proceso" in df.columns:
            estado_counter.update(clean_text(v) for v in df["Estado del proceso"] if clean_text(v))
        if "Día" in df.columns:
            for v in df["Día"].dropna():
                try:
                    anio_counter[pd.to_datetime(v, dayfirst=True).year] += 1
                except Exception:
                    pass

    print("\n  Top 15 canales crudos:")
    top(canal_counter, 15)
    print("\n  Top 15 estados crudos:")
    top(estado_counter, 15)
    print("\n  Prospectos por año detectado:")
    for anio, count in sorted(anio_counter.items()):
        print(f"    {anio}: {count}")

    print("\n  Distribución de categorías normalizadas (canal):")
    cat_counter: Counter = Counter()
    for val in canal_counter.elements():
        cat = normalizar_canal_llegada(val).categoria
        cat_counter[cat or "None"] += canal_counter[val]
    top(cat_counter, 20)

    print("\n  Distribución de categorías normalizadas (estado):")
    est_cat: Counter = Counter()
    for val in estado_counter.elements():
        cat = normalizar_estado_proceso(val)
        est_cat[cat] += estado_counter[val]
    top(est_cat, 15)


def audit_citas_info(filepath: Path) -> None:
    sep("CITAS DE INFORMACIÓN 2026")
    for sheet in ["Primaria - Preescolar", "Bachillerato"]:
        try:
            df = pd.read_excel(filepath, sheet_name=sheet, header=0).dropna(how="all")
        except Exception as e:
            print(f"  [{sheet}] ERROR: {e}")
            continue
        total = len(df)
        print(f"\n  [{sheet}]  {total} filas")
        for campo in ["Nombre Estudiante", "Grado", "Fecha", "Como llegó al colegio?", "Tipo de Contacto", "Asistió"]:
            if campo in df.columns:
                vacios = df[campo].isna().sum()
                print(f"    '{campo}' vacío: {vacios} ({pct(vacios, total)})")

        if "Unnamed: 0" in df.columns:
            flags = Counter(clean_text(v) for v in df["Unnamed: 0"] if clean_text(v))
            print(f"    Flags OK: {dict(flags)}")

        if "Grados perdidos" in df.columns:
            vals = Counter(clean_text(v) for v in df["Grados perdidos"] if clean_text(v))
            print(f"    'Grados perdidos' (valores únicos): {dict(vals)}")

    print("\n  SEGUIMIENTOS:")
    for sheet in ["Seguimiento Preescolar", "Seguimiento Primaria", "Seguimiento Bachillerato"]:
        try:
            df_raw = pd.read_excel(filepath, sheet_name=sheet, header=None)
            df = df_raw.iloc[2:].dropna(how="all")
            print(f"    [{sheet}]  {len(df)} filas")
        except Exception as e:
            print(f"    [{sheet}] ERROR: {e}")


def audit_citas_individuales(filepath: Path) -> None:
    sep("CITAS INDIVIDUALES 2025")
    sheets = ["Preescolar", "Bachillerato Adriana", "Bachillerato Eliana", "Bachillerato Rosita"]
    for sheet in sheets:
        try:
            df = pd.read_excel(filepath, sheet_name=sheet, header=0).dropna(how="all")
        except Exception as e:
            print(f"  [{sheet}] ERROR: {e}")
            continue
        total = len(df)
        matriculados = 0
        if "Matrícula" in df.columns:
            matriculados = df["Matrícula"].notna().sum()
        inicio = df.get("Inicio proceso", pd.Series()).notna().sum()
        print(f"  [{sheet}]  {total} filas  |  inicio: {inicio}  |  matrícula: {matriculados}")

        if "Como conoció el colegio" in df.columns:
            canal_counter: Counter = Counter(
                clean_text(v) for v in df["Como conoció el colegio"] if clean_text(v)
            )
            print(f"    Top canales: {dict(canal_counter.most_common(5))}")


def main() -> None:
    data_dir = _first_data_dir()

    try:
        audit_morral(find_workbook(data_dir, "morral"))
    except FileNotFoundError as e:
        print(f"Morral no encontrado: {e}")

    try:
        audit_embudo(find_workbook(data_dir, "embudo"))
    except FileNotFoundError as e:
        print(f"Embudo no encontrado: {e}")

    try:
        audit_citas_info(find_workbook(data_dir, "informaci"))
    except FileNotFoundError as e:
        print(f"Citas info no encontrado: {e}")

    try:
        audit_citas_individuales(find_workbook(data_dir, "individuales"))
    except FileNotFoundError as e:
        print(f"Citas individuales no encontrado: {e}")

    sep("FIN DEL REPORTE DE AUDITORÍA")


if __name__ == "__main__":
    main()
