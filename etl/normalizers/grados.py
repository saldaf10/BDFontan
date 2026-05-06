from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .text import canonical


PREESCOLAR = {
    "PREJARDIN": "PREJARDIN",
    "PRE JARDIN": "PREJARDIN",
    "JARDIN": "JARDIN",
    "TRANSICION": "TRANSICION"
}


@dataclass(frozen=True)
class GradoNormalizado:
    primario: str | None
    secundario: str | None = None


def normalizar_grado(value: Any) -> GradoNormalizado:
    text = canonical(value)
    if not text:
        return GradoNormalizado(None)

    if text in PREESCOLAR:
        return GradoNormalizado(PREESCOLAR[text])

    numbers = re.findall(r"\b(1[0-1]|[1-9])\s*°?", text)
    if len(numbers) >= 2:
        return GradoNormalizado(f"{numbers[0]}°", f"{numbers[1]}°")
    if len(numbers) == 1:
        return GradoNormalizado(f"{numbers[0]}°")

    for original, normalized in PREESCOLAR.items():
        if original in text:
            return GradoNormalizado(normalized)

    if " Y " in f" {text} ":
        return GradoNormalizado("MULTIPLE")

    return GradoNormalizado(text)


def inferir_nivel(grado: Any, fallback: str | None = None) -> str | None:
    normalized = normalizar_grado(grado).primario
    if normalized in {"PREJARDIN", "JARDIN", "TRANSICION"}:
        return "PREESCOLAR"
    if normalized in {"1°", "2°", "3°", "4°", "5°"}:
        return "PRIMARIA"
    if normalized in {"6°", "7°", "8°", "9°", "10°", "11°"}:
        return "BACHILLERATO"
    return fallback
