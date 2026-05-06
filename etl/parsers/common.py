from __future__ import annotations

from pathlib import Path


def find_workbook(data_dir: Path, *name_parts: str) -> Path:
    normalized_parts = [part.lower() for part in name_parts]
    for path in data_dir.glob("*.xlsx"):
        name = path.name.lower()
        if all(part in name for part in normalized_parts):
            return path
    raise FileNotFoundError(f"No workbook found with parts: {', '.join(name_parts)}")
