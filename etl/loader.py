from __future__ import annotations

import os
import uuid
from collections.abc import Mapping
from dataclasses import asdict, is_dataclass
from datetime import date
from decimal import Decimal
from typing import Any

import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

from etl.normalizers.text import canonical


TABLES_TO_CHECK = [
    "prospecto",
    "estudiante",
    "evento_institucional",
    "asistencia_evento"
]

TABLES_TO_TRUNCATE = [
    "asistencia_evento",
    "evento_institucional",
    "seguimiento",
    "etapa_proceso",
    "cita_informacion",
    "prospecto",
    "estudiante_acudiente",
    "acudiente",
    "estudiante",
    "canal_llegada_cat"
]


def load_to_postgres(parsed: dict[str, object], reset: bool = False) -> None:
    database_url = _database_url()
    with psycopg2.connect(database_url, cursor_factory=RealDictCursor) as conn:
        with conn.cursor() as cur:
            if reset:
                _truncate(cur)
            elif _has_existing_data(cur):
                raise RuntimeError(
                    "La base ya tiene datos. Usa --reset junto con --load si quieres recargar desde cero."
                )

            loader = BulkLoader(cur)
            loader.load(parsed)
        conn.commit()


class BulkLoader:
    def __init__(self, cur: RealDictCursor) -> None:
        self.cur = cur
        self.students_by_key: dict[str, str] = {}
        self.events_by_key: dict[tuple[str, date, str, str], str] = {}
        self.prospects_by_student_key: dict[str, str] = {}
        self.acudientes_by_key: dict[str, str] = {}
        self.canales_by_original: dict[str, tuple[str, str, str | None]] = {}
        self.student_rows: list[tuple[Any, ...]] = []
        self.acudiente_rows: list[tuple[Any, ...]] = []
        self.link_rows: set[tuple[Any, ...]] = set()
        self.event_rows: list[tuple[Any, ...]] = []
        # Keyed by (id_estudiante, id_evento) to avoid duplicates in the same batch
        self.asistencia_by_key: dict[tuple[str, str], tuple[Any, ...]] = {}
        self.prospect_rows: list[tuple[Any, ...]] = []
        self.cita_rows: list[tuple[Any, ...]] = []
        self.etapa_rows: list[tuple[Any, ...]] = []
        self.seguimiento_rows: list[tuple[Any, ...]] = []

    def load(self, parsed: dict[str, object]) -> None:
        print("Preparando datos para carga por lotes...", flush=True)
        self._prepare_morral(parsed["morral"])
        self._prepare_prospect_records(parsed["embudo"])
        self._prepare_prospect_records(parsed["citas_individuales"])

        citas_info = parsed["citas_info"]
        assert isinstance(citas_info, dict)
        self._prepare_prospect_records(citas_info["prospectos"])
        self._prepare_seguimientos(citas_info["seguimientos"])

        print("Insertando lotes en PostgreSQL...", flush=True)
        self._insert_batches()

    def _prepare_morral(self, morral: object) -> None:
        assert isinstance(morral, dict)
        for sheet in morral.values():
            for event in sheet["eventos"]:
                self._event_id(event)

            for estudiante in sheet["estudiantes"]:
                student_id = self._student_id(estudiante)
                self._morral_acudiente(student_id, estudiante, "madre", "email_madre", "MADRE", 1)
                self._morral_acudiente(student_id, estudiante, "padre", "email_padre", "PADRE", 2)

            for asistencia in sheet["asistencias"]:
                event_id = self._event_id(asistencia["evento"])
                student_id = self.students_by_key.get(asistencia["estudiante_key"])
                if student_id and event_id:
                    key = (student_id, event_id)
                    self.asistencia_by_key[key] = (str(uuid.uuid4()), student_id, event_id, asistencia["resultado"], None)

    def _prepare_prospect_records(self, records: object) -> None:
        assert isinstance(records, list)
        for record in records:
            student = record["estudiante"]
            student_id = self._student_id(student)
            student_key = _student_key(student)
            acudiente = record.get("acudiente")
            if acudiente:
                acudiente_id = self._acudiente_id(acudiente)
                if acudiente_id:
                    self.link_rows.add((str(uuid.uuid4()), student_id, acudiente_id, "OTRO", 1))

            self._canal_llegada(record["prospecto"])
            prospect_id = self._prospect_id(record["prospecto"], student_id)
            self.prospects_by_student_key[student_key] = prospect_id
            self._cita(prospect_id, record["cita_informacion"])
            for etapa in record.get("etapas", []):
                self._etapa(prospect_id, etapa)

    def _prepare_seguimientos(self, seguimientos: object) -> None:
        assert isinstance(seguimientos, list)
        for seguimiento in seguimientos:
            prospect_id = self.prospects_by_student_key.get(seguimiento["estudiante_key"])
            if not prospect_id:
                student = {
                    "nombre_completo": seguimiento["nombre_estudiante"],
                    "grado": seguimiento["grado"],
                    "nivel": seguimiento["nivel"],
                    "origen_archivo": seguimiento["origen_archivo"]
                }
                student_id = self._student_id(student)
                prospect_id = self._prospect_id({
                    "anio_proceso": 2026,
                    "grado_primario": seguimiento["grado"],
                    "nivel": seguimiento["nivel"],
                    "estado_proceso_original": seguimiento.get("estado_proceso"),
                    "origen_archivo": seguimiento["origen_archivo"]
                }, student_id)
                self.prospects_by_student_key[seguimiento["estudiante_key"]] = prospect_id

            self.seguimiento_rows.append((
                str(uuid.uuid4()),
                prospect_id,
                _clean(seguimiento.get("numero_contacto")),
                _clean(seguimiento.get("fecha")),
                _clean(seguimiento.get("medio")),
                _clean(seguimiento.get("observacion")),
                _clean(seguimiento.get("fecha_nacimiento")),
                _decimal_or_none(seguimiento.get("edad"))
            ))

    def _student_id(self, student: Mapping[str, Any]) -> str:
        key = _student_key(student)
        if key in self.students_by_key:
            return self.students_by_key[key]
        student_id = str(uuid.uuid4())
        self.students_by_key[key] = student_id
        self.student_rows.append((
            student_id,
            _clean(student.get("codigo_interno")),
            _clean(student.get("nombre_completo")),
            _clean(student.get("grado")),
            _clean(student.get("nivel")),
            _clean(student.get("anio_ingreso")),
            _clean(student.get("origen_archivo"))
        ))
        return student_id

    def _event_id(self, event: object) -> str | None:
        event_dict = asdict(event) if is_dataclass(event) else dict(event)
        event_date = _clean(event_dict.get("fecha"))
        if not event_date:
            return None
        key = (event_dict["nombre"], event_date, event_dict["nivel"], event_dict["anio_escolar"])
        if key in self.events_by_key:
            return self.events_by_key[key]
        event_id = str(uuid.uuid4())
        self.events_by_key[key] = event_id
        self.event_rows.append((
            event_id,
            event_dict["nombre"],
            event_date,
            event_dict.get("tipo"),
            event_dict["nivel"],
            event_dict["anio_escolar"]
        ))
        return event_id

    def _morral_acudiente(
        self,
        student_id: str,
        estudiante: Mapping[str, Any],
        name_key: str,
        email_key: str,
        relacion: str,
        orden: int
    ) -> None:
        acudiente_id = self._acudiente_id({
            "nombre_completo": estudiante.get(name_key),
            "email": estudiante.get(email_key)
        })
        if acudiente_id:
            self.link_rows.add((str(uuid.uuid4()), student_id, acudiente_id, relacion, orden))

    def _acudiente_id(self, acudiente: Mapping[str, Any]) -> str | None:
        name = _clean(acudiente.get("nombre_completo"))
        if not name:
            return None
        key = "|".join([
            canonical(name),
            canonical(acudiente.get("email")),
            canonical(acudiente.get("telefono"))
        ])
        if key in self.acudientes_by_key:
            return self.acudientes_by_key[key]
        acudiente_id = str(uuid.uuid4())
        self.acudientes_by_key[key] = acudiente_id
        self.acudiente_rows.append((
            acudiente_id,
            name,
            _clean(acudiente.get("email")),
            _clean(acudiente.get("telefono"))
        ))
        return acudiente_id

    def _canal_llegada(self, prospecto: Mapping[str, Any]) -> None:
        original = _clean(prospecto.get("canal_llegada_original"))
        categoria = _clean(prospecto.get("canal_llegada"))
        if original and categoria:
            self.canales_by_original[original] = (
                str(uuid.uuid4()),
                original,
                categoria,
                _clean(prospecto.get("referido_nombre"))
            )

    def _prospect_id(self, prospecto: Mapping[str, Any], student_id: str) -> str:
        prospect_id = str(uuid.uuid4())
        self.prospect_rows.append((
            prospect_id,
            student_id,
            _clean(prospecto.get("anio_proceso")) or 2026,
            _clean(prospecto.get("canal_llegada")),
            _clean(prospecto.get("canal_llegada_original")),
            _clean(prospecto.get("referido_nombre")),
            _clean(prospecto.get("asesor")),
            _clean(prospecto.get("grado_primario")),
            _clean(prospecto.get("grado_secundario")),
            _clean(prospecto.get("nivel")),
            _clean(prospecto.get("estado_proceso_cat")),
            _clean(prospecto.get("estado_proceso_original")),
            _clean(prospecto.get("observaciones")),
            _clean(prospecto.get("flag_ok")),
            bool(prospecto.get("contacto_mejores_colegios", False)),
            _clean(prospecto.get("mes_cita")),
            _clean(prospecto.get("origen_archivo"))
        ))
        return prospect_id

    def _cita(self, prospect_id: str, cita: Mapping[str, Any]) -> None:
        self.cita_rows.append((
            str(uuid.uuid4()),
            prospect_id,
            _clean(cita.get("fecha")),
            _clean(cita.get("asistio")),
            _clean(cita.get("tipo_contacto")),
            _clean(cita.get("observaciones"))
        ))

    def _etapa(self, prospect_id: str, etapa: Mapping[str, Any]) -> None:
        self.etapa_rows.append((
            str(uuid.uuid4()),
            prospect_id,
            etapa["etapa"],
            _clean(etapa.get("fecha")),
            bool(etapa.get("completada")),
            _clean(etapa.get("admitido"))
        ))

    def _insert_batches(self) -> None:
        self._insert("canal_llegada_cat", "(id, valor_original, categoria, referido_nombre)", list(self.canales_by_original.values()))
        self._insert("estudiante", "(id, codigo_interno, nombre_completo, grado, nivel, anio_ingreso, origen_archivo)", self.student_rows)
        self._insert("acudiente", "(id, nombre_completo, email, telefono)", self.acudiente_rows)
        self._insert(
            "estudiante_acudiente",
            "(id, id_estudiante, id_acudiente, relacion, orden)",
            list(self.link_rows),
            "ON CONFLICT (id_estudiante, id_acudiente) DO NOTHING"
        )
        self._insert("evento_institucional", "(id, nombre, fecha, tipo, nivel, anio_escolar)", self.event_rows)
        self._insert(
            "asistencia_evento",
            "(id, id_estudiante, id_evento, resultado, excusa)",
            list(self.asistencia_by_key.values()),
            "ON CONFLICT (id_estudiante, id_evento) DO UPDATE SET resultado = EXCLUDED.resultado"
        )
        self._insert(
            "prospecto",
            """(
              id, id_estudiante, anio_proceso, canal_llegada, canal_llegada_original,
              referido_nombre, asesor, grado_primario, grado_secundario, nivel,
              estado_proceso_cat, estado_proceso_original, observaciones, flag_ok,
              contacto_mejores_colegios, mes_cita, origen_archivo
            )""",
            self.prospect_rows
        )
        self._insert("cita_informacion", "(id, id_prospecto, fecha, asistio, tipo_contacto, observaciones)", self.cita_rows)
        self._insert("etapa_proceso", "(id, id_prospecto, etapa, fecha, completada, admitido)", self.etapa_rows)
        self._insert(
            "seguimiento",
            "(id, id_prospecto, numero_contacto, fecha, medio, observacion, fecha_nacimiento, edad)",
            self.seguimiento_rows
        )

    def _insert(
        self,
        table: str,
        columns: str,
        rows: list[tuple[Any, ...]],
        conflict_clause: str = ""
    ) -> None:
        if not rows:
            return
        print(f"- {table}: {len(rows)} filas", flush=True)
        execute_values(
            self.cur,
            f"INSERT INTO {table} {columns} VALUES %s {conflict_clause}",
            rows,
            page_size=1000
        )


class Loader:
    def __init__(self, cur: RealDictCursor) -> None:
        self.cur = cur
        self.students_by_key: dict[str, str] = {}
        self.events_by_key: dict[tuple[str, date, str, str], str] = {}
        self.prospects_by_student_key: dict[str, str] = {}
        self.acudientes_by_key: dict[str, str] = {}

    def load(self, parsed: dict[str, object]) -> None:
        self._load_morral(parsed["morral"])
        self._load_prospect_records(parsed["embudo"])
        self._load_prospect_records(parsed["citas_individuales"])

        citas_info = parsed["citas_info"]
        assert isinstance(citas_info, dict)
        self._load_prospect_records(citas_info["prospectos"])
        self._load_seguimientos(citas_info["seguimientos"])

    def _load_morral(self, morral: object) -> None:
        assert isinstance(morral, dict)
        for sheet in morral.values():
            for event in sheet["eventos"]:
                self._upsert_event(event)

            for estudiante in sheet["estudiantes"]:
                student_id = self._upsert_student(estudiante)
                self._upsert_morral_acudiente(student_id, estudiante, "madre", "email_madre", "MADRE", 1)
                self._upsert_morral_acudiente(student_id, estudiante, "padre", "email_padre", "PADRE", 2)

            for asistencia in sheet["asistencias"]:
                event_id = self._upsert_event(asistencia["evento"])
                student_id = self.students_by_key.get(asistencia["estudiante_key"])
                if student_id and event_id:
                    self.cur.execute(
                        """
                        INSERT INTO asistencia_evento (id_estudiante, id_evento, resultado)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (id_estudiante, id_evento)
                        DO UPDATE SET resultado = EXCLUDED.resultado
                        """,
                        (student_id, event_id, asistencia["resultado"])
                    )

    def _load_prospect_records(self, records: object) -> None:
        assert isinstance(records, list)
        for record in records:
            student = record["estudiante"]
            student_id = self._upsert_student(student)
            student_key = _student_key(student)
            acudiente = record.get("acudiente")
            if acudiente:
                acudiente_id = self._upsert_acudiente(acudiente)
                if acudiente_id:
                    self._link_acudiente(student_id, acudiente_id, "OTRO", 1)

            self._upsert_canal_llegada(record["prospecto"])
            prospect_id = self._insert_prospect(record["prospecto"], student_id)
            self.prospects_by_student_key[student_key] = prospect_id
            self._insert_cita(prospect_id, record["cita_informacion"])
            for etapa in record.get("etapas", []):
                self._insert_etapa(prospect_id, etapa)

    def _load_seguimientos(self, seguimientos: object) -> None:
        assert isinstance(seguimientos, list)
        for seguimiento in seguimientos:
            prospect_id = self.prospects_by_student_key.get(seguimiento["estudiante_key"])
            if not prospect_id:
                student = {
                    "nombre_completo": seguimiento["nombre_estudiante"],
                    "grado": seguimiento["grado"],
                    "nivel": seguimiento["nivel"],
                    "origen_archivo": seguimiento["origen_archivo"]
                }
                student_id = self._upsert_student(student)
                prospect_id = self._insert_prospect({
                    "anio_proceso": 2026,
                    "grado_primario": seguimiento["grado"],
                    "nivel": seguimiento["nivel"],
                    "estado_proceso_original": seguimiento.get("estado_proceso"),
                    "origen_archivo": seguimiento["origen_archivo"]
                }, student_id)
                self.prospects_by_student_key[seguimiento["estudiante_key"]] = prospect_id

            self.cur.execute(
                """
                INSERT INTO seguimiento (
                  id_prospecto, numero_contacto, fecha, medio, observacion,
                  fecha_nacimiento, edad
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    prospect_id,
                    _clean(seguimiento.get("numero_contacto")),
                    _clean(seguimiento.get("fecha")),
                    _clean(seguimiento.get("medio")),
                    _clean(seguimiento.get("observacion")),
                    _clean(seguimiento.get("fecha_nacimiento")),
                    _decimal_or_none(seguimiento.get("edad"))
                )
            )

    def _upsert_student(self, student: Mapping[str, Any]) -> str:
        key = _student_key(student)
        if key in self.students_by_key:
            return self.students_by_key[key]

        self.cur.execute(
            """
            INSERT INTO estudiante (
              codigo_interno, nombre_completo, grado, nivel, anio_ingreso, origen_archivo
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                _clean(student.get("codigo_interno")),
                _clean(student.get("nombre_completo")),
                _clean(student.get("grado")),
                _clean(student.get("nivel")),
                _clean(student.get("anio_ingreso")),
                _clean(student.get("origen_archivo"))
            )
        )
        student_id = str(self.cur.fetchone()["id"])
        self.students_by_key[key] = student_id
        return student_id

    def _upsert_event(self, event: object) -> str | None:
        event_dict = asdict(event) if is_dataclass(event) else dict(event)
        event_date = _clean(event_dict.get("fecha"))
        if not event_date:
            return None

        key = (
            event_dict["nombre"],
            event_date,
            event_dict["nivel"],
            event_dict["anio_escolar"]
        )
        if key in self.events_by_key:
            return self.events_by_key[key]

        self.cur.execute(
            """
            INSERT INTO evento_institucional (nombre, fecha, tipo, nivel, anio_escolar)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (nombre, fecha, nivel, anio_escolar)
            DO UPDATE SET tipo = EXCLUDED.tipo
            RETURNING id
            """,
            (
                event_dict["nombre"],
                event_date,
                event_dict.get("tipo"),
                event_dict["nivel"],
                event_dict["anio_escolar"]
            )
        )
        event_id = str(self.cur.fetchone()["id"])
        self.events_by_key[key] = event_id
        return event_id

    def _upsert_morral_acudiente(
        self,
        student_id: str,
        estudiante: Mapping[str, Any],
        name_key: str,
        email_key: str,
        relacion: str,
        orden: int
    ) -> None:
        acudiente_id = self._upsert_acudiente({
            "nombre_completo": estudiante.get(name_key),
            "email": estudiante.get(email_key)
        })
        if acudiente_id:
            self._link_acudiente(student_id, acudiente_id, relacion, orden)

    def _upsert_acudiente(self, acudiente: Mapping[str, Any]) -> str | None:
        name = _clean(acudiente.get("nombre_completo"))
        if not name:
            return None
        key = "|".join([
            canonical(name),
            canonical(acudiente.get("email")),
            canonical(acudiente.get("telefono"))
        ])
        if key in self.acudientes_by_key:
            return self.acudientes_by_key[key]

        self.cur.execute(
            """
            INSERT INTO acudiente (nombre_completo, email, telefono)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (name, _clean(acudiente.get("email")), _clean(acudiente.get("telefono")))
        )
        acudiente_id = str(self.cur.fetchone()["id"])
        self.acudientes_by_key[key] = acudiente_id
        return acudiente_id

    def _link_acudiente(self, student_id: str, acudiente_id: str, relacion: str, orden: int) -> None:
        self.cur.execute(
            """
            INSERT INTO estudiante_acudiente (id_estudiante, id_acudiente, relacion, orden)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (id_estudiante, id_acudiente) DO NOTHING
            """,
            (student_id, acudiente_id, relacion, orden)
        )

    def _upsert_canal_llegada(self, prospecto: Mapping[str, Any]) -> None:
        original = _clean(prospecto.get("canal_llegada_original"))
        categoria = _clean(prospecto.get("canal_llegada"))
        if not original or not categoria:
            return
        self.cur.execute(
            """
            INSERT INTO canal_llegada_cat (valor_original, categoria, referido_nombre)
            VALUES (%s, %s, %s)
            ON CONFLICT (valor_original)
            DO UPDATE SET categoria = EXCLUDED.categoria,
                          referido_nombre = EXCLUDED.referido_nombre
            """,
            (original, categoria, _clean(prospecto.get("referido_nombre")))
        )

    def _insert_prospect(self, prospecto: Mapping[str, Any], student_id: str) -> str:
        self.cur.execute(
            """
            INSERT INTO prospecto (
              id_estudiante, anio_proceso, canal_llegada, canal_llegada_original,
              referido_nombre, asesor, grado_primario, grado_secundario, nivel,
              estado_proceso_cat, estado_proceso_original, observaciones, flag_ok,
              contacto_mejores_colegios, mes_cita, origen_archivo
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                student_id,
                _clean(prospecto.get("anio_proceso")) or 2026,
                _clean(prospecto.get("canal_llegada")),
                _clean(prospecto.get("canal_llegada_original")),
                _clean(prospecto.get("referido_nombre")),
                _clean(prospecto.get("asesor")),
                _clean(prospecto.get("grado_primario")),
                _clean(prospecto.get("grado_secundario")),
                _clean(prospecto.get("nivel")),
                _clean(prospecto.get("estado_proceso_cat")),
                _clean(prospecto.get("estado_proceso_original")),
                _clean(prospecto.get("observaciones")),
                _clean(prospecto.get("flag_ok")),
                bool(prospecto.get("contacto_mejores_colegios", False)),
                _clean(prospecto.get("mes_cita")),
                _clean(prospecto.get("origen_archivo"))
            )
        )
        return str(self.cur.fetchone()["id"])

    def _insert_cita(self, prospect_id: str, cita: Mapping[str, Any]) -> None:
        self.cur.execute(
            """
            INSERT INTO cita_informacion (
              id_prospecto, fecha, asistio, tipo_contacto, observaciones
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                prospect_id,
                _clean(cita.get("fecha")),
                _clean(cita.get("asistio")),
                _clean(cita.get("tipo_contacto")),
                _clean(cita.get("observaciones"))
            )
        )

    def _insert_etapa(self, prospect_id: str, etapa: Mapping[str, Any]) -> None:
        self.cur.execute(
            """
            INSERT INTO etapa_proceso (
              id_prospecto, etapa, fecha, completada, admitido
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                prospect_id,
                etapa["etapa"],
                _clean(etapa.get("fecha")),
                bool(etapa.get("completada")),
                _clean(etapa.get("admitido"))
            )
        )


def _has_existing_data(cur: RealDictCursor) -> bool:
    for table in TABLES_TO_CHECK:
        cur.execute(f"SELECT EXISTS (SELECT 1 FROM {table} LIMIT 1) AS has_rows")
        if cur.fetchone()["has_rows"]:
            return True
    return False


def _truncate(cur: RealDictCursor) -> None:
    cur.execute(f"TRUNCATE TABLE {', '.join(TABLES_TO_TRUNCATE)} RESTART IDENTITY CASCADE")


def _student_key(student: Mapping[str, Any]) -> str:
    return f"{canonical(student.get('nombre_completo'))}|{canonical(student.get('grado'))}"


def _database_url() -> str:
    url = (
        os.getenv("DATABASE_URL_UNPOOLED")
        or os.getenv("POSTGRES_URL_NON_POOLING")
        or os.getenv("DIRECT_URL")
        or os.getenv("DATABASE_URL")
    )
    if not url:
        raise RuntimeError("No database URL found in environment")
    return url


def _clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if not isinstance(value, (str, bytes, date)):
        try:
            if pd.isna(value):
                return None
        except (TypeError, ValueError):
            pass
    if hasattr(value, "item"):
        return value.item()
    return value


def _decimal_or_none(value: Any) -> Decimal | None:
    value = _clean(value)
    if value is None:
        return None
    return Decimal(str(value))
