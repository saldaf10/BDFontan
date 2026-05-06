from __future__ import annotations

from typing import Any

from .text import canonical


def normalizar_estado_proceso(value: Any) -> str:
    text = canonical(value)
    if not text:
        return "pendiente"

    # ── Matrícula ──────────────────────────────────────────────────────────
    if any(t in text for t in ["MATRIC", "CUPO RESERV", "POR MATRICULAR", "CUPO APARTA"]):
        return "matriculado"

    # ── No admitido ────────────────────────────────────────────────────────
    if any(t in text for t in ["NO ADMIT", "NO SE ADMIT", "NO PASO", "NO APROBAD"]):
        return "no_admitido"

    # ── Desiste ────────────────────────────────────────────────────────────
    if any(t in text for t in [
        "DESIST", "RETIRA", "NO CONTINUA", "NO INICIA", "NO DESEA INICIAR",
        "NO DESEA CONTINUAR", "NO QUIERE", "CANCELA", "RECHAZ"
    ]):
        # Verificar que no sea por costos antes de marcar como desiste genérico
        if not any(t in text for t in ["COSTO", "ECONOMIC", "PRECIO", "PAGO", "VALOR"]):
            return "desiste"

    # ── No continúa por costos ─────────────────────────────────────────────
    if any(t in text for t in ["COSTO", "ECONOMIC", "PRECIO", "PAGO", "VALOR", "FINANCIER"]):
        return "no_continua_costos"

    # ── No responde ────────────────────────────────────────────────────────
    if any(t in text for t in ["NO RESP", "NO CONTEST", "NO ATIENDE", "NO SE LOCALIZ"]):
        return "no_responde"

    # ── Otro colegio ───────────────────────────────────────────────────────
    if any(t in text for t in [
        "OTRO COLEGIO", "COLEGIO ACTUAL", "QUEDARAN", "QUEDAN EN", "OPTA POR OTRO",
        "PROCESO EN OTRO", "SE QUEDA EN"
    ]):
        return "otro_colegio"

    # ── Edad insuficiente ──────────────────────────────────────────────────
    if any(t in text for t in [
        "GESTACION", "GESTACIÓN", "BEBE", "BEBÉ", "1 ANO", "2 ANOS",
        "1 AÑO", "2 AÑOS", "MUY PEQUENO", "MUY PEQUEÑO", "NO TIENE EDAD"
    ]):
        return "edad_insuficiente"

    # ── Necesidades especiales ─────────────────────────────────────────────
    if any(t in text for t in [
        "AUTIS", "NECESIDADES", "DISCAPACIDAD", "SINDROME", "SÍNDROME",
        "COGNITIV", "NEURODIVERSID"
    ]):
        return "necesidades_especiales"

    # ── Proceso futuro ─────────────────────────────────────────────────────
    if any(t in text for t in [
        "2025", "2026", "2027", "2028", "MAS ADELANTE", "MÁS ADELANTE",
        "FUTURO", "PROXIMO ANO", "PRÓXIMO AÑO", "INGRESO FUTURO", "ESPERA"
    ]):
        return "proceso_futuro"

    # ── Pensando / indeciso ────────────────────────────────────────────────
    if any(t in text for t in [
        "PENS", "MIRANDO", "VALIDANDO", "DECISION", "DECISIÓN",
        "EVALUANDO", "ANALIZANDO", "DUDAS", "VER", "CONSIDERANDO"
    ]):
        return "pensando"

    return "pendiente"
