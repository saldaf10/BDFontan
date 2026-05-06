from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .text import canonical, clean_text


@dataclass(frozen=True)
class CanalLlegada:
    original: str | None
    categoria: str | None
    referido_nombre: str | None = None


def normalizar_canal_llegada(value: Any) -> CanalLlegada:
    original = clean_text(value)
    text = canonical(original)
    if not text:
        return CanalLlegada(original, None)

    # ── Referidos: orden importante (más específico primero) ────────────────
    if any(token in text for token in ["EGRESAD", "EX ALUM", "PADRE EGRES", "MADRE EGRES"]):
        return CanalLlegada(original, "referido_egresado", _referido_nombre(original))

    if any(token in text for token in [
        "PSICOLOG", "PSIQUIATR", "NEUROPSICOLOG",
        "DRA ", "DR ", "DRA.", "DR.", "MEDIC", "TERAPEUT", "FONOAUDIOLOG"
    ]):
        return CanalLlegada(original, "referido_profesional", _referido_nombre(original))

    if any(token in text for token in ["RECTOR", "RECTORA", "DOCENTE", "JARDIN ", "JARDÍN"]):
        return CanalLlegada(original, "referido_rector_docente", _referido_nombre(original))

    # "Referido" genérico o "Recomendado" → familia (por defecto)
    if "REFER" in text or "RECOMEND" in text or "NOS CONTARON" in text or "LE CONTARON" in text:
        return CanalLlegada(original, "referido_familia", _referido_nombre(original))

    # ── Digital ────────────────────────────────────────────────────────────
    if any(token in text for token in ["PAUTA", "ADS", "PUBLICIDAD"]):
        return CanalLlegada(original, "pauta_digital")

    if any(token in text for token in ["INSTAGRAM", "FACEBOOK", "TIKTOK", "REDES", "ANUNCIO"]):
        return CanalLlegada(original, "redes_sociales")

    if any(token in text for token in [
        "INTERNET", "BUSQUEDA", "BUSCANDO", "GOOGLE", "WEB", "PAGINA", "PORTAL", "ONLINE"
    ]):
        return CanalLlegada(original, "internet")

    # ── Eventos / otros canales ────────────────────────────────────────────
    if "FERIA" in text:
        return CanalLlegada(original, "feria")

    if "CRM" in text:
        return CanalLlegada(original, "crm")

    if any(token in text for token in ["VECINO", "SECTOR", "VIA", "PASARON", "PASO POR"]):
        return CanalLlegada(original, "vecinos")

    if any(token in text for token in ["TIEMPO ATRAS", "TIEMPO ATRÁS", "CONOCIAN", "CONOCE", "SIEMPRE"]):
        return CanalLlegada(original, "conoce_tiempo_atras")

    if any(token in text for token in [
        "COLEGIO ALEMAN", "MONTESSORI", "COLUMBUS", "COLINA", "COLOMBO",
        "BRITANICO", "OTRA INSTITUCION", "OTRO COLEGIO"
    ]):
        return CanalLlegada(original, "otro_colegio")

    return CanalLlegada(original, "otros")


def _referido_nombre(original: str | None) -> str | None:
    """Extrae el nombre de la persona que refirió, del texto original."""
    if not original:
        return None

    # Patrones: "Referido por Juan Pérez", "Referido - familia Higuita",
    #           "Referido: Neuropsicologa Johana", "Referido familia Elias Ortiz"
    patterns = [
        r"(?:referido|referida|recomendado|recomendada)\s+(?:por|a través de|de)?\s*[:\-]?\s*(.+)",
        r"(?:familia|egresad[oa]|psicolog[oa]|dra?\.?|rector[a]?)\s+(.+)",
    ]
    lower = original.lower().strip()
    for pattern in patterns:
        match = re.search(pattern, lower)
        if match:
            candidate = match.group(1).strip(" .:-,")
            # Descartar si el candidato es muy corto o es basura
            if len(candidate) > 2 and candidate not in {"si", "no", "ok"}:
                return candidate.title()

    # Fallback: separar por delimitadores comunes
    for sep in [" - ", ": ", " por ", " Por ", " familia ", " Familia "]:
        if sep in original:
            candidate = original.split(sep, 1)[1].strip(" .:-")
            if len(candidate) > 2:
                return candidate
    return None
