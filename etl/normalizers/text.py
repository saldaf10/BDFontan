from __future__ import annotations

import math
import re
from datetime import date, datetime
from typing import Any

import pandas as pd
from unidecode import unidecode


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return pd.isna(value)


def clean_text(value: Any) -> str | None:
    if is_empty(value):
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "nat", "none"}:
        return None
    return re.sub(r"\s+", " ", text)


def canonical(value: Any) -> str:
    text = clean_text(value) or ""
    return unidecode(text).upper().strip()


def to_date(value: Any) -> date | None:
    if is_empty(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = clean_text(value)
    if text:
        match = re.search(r"\b\d{1,2}/\d{1,2}/\d{4}\b", text)
        if match:
            value = match.group(0)
    parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)
    if pd.isna(parsed):
        return None
    return parsed.date()


def to_bool_si_no(value: Any) -> bool | None:
    text = canonical(value)
    if not text:
        return None
    if text in {"SI", "S", "X", "OK", "1", "TRUE"}:
        return True
    if text in {"NO", "N", "0", "FALSE"}:
        return False
    return None
