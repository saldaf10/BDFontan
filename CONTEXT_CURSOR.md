# Contexto completo del proyecto — Sistema de gestión Colegio Fontán

## Objetivo

Migrar 4 archivos Excel que el colegio usa como "bases de datos" a un sistema real con:
- **Backend**: PostgreSQL como base de datos
- **ETL**: Script Python que lee los Excel, limpia y migra todos los datos sin pérdida
- **Frontend**: Next.js desplegado en Vercel

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Base de datos | PostgreSQL |
| ORM / Migraciones | Prisma |
| Backend API | Next.js API Routes (App Router) |
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| ETL / Migración | Python 3, pandas, psycopg2 |
| Deploy | Vercel (frontend + API routes), Railway o Supabase (PostgreSQL) |

---

## Fuentes de datos — los 4 archivos Excel

### Archivo 1: `Base_de_datos_póngase_el_morral.xlsx`

Registra asistencia de **estudiantes matriculados** a eventos institucionales.

**Sheets y estructura:**

| Sheet | Filas de datos | Eventos registrados |
|---|---|---|
| Preescolar 24-25 | 65 | 11 eventos |
| Primaria 24-25 | 234 | 11 eventos |
| Bachillerato 24-25 | 265 | 11 eventos |
| Preescolar 2026 | 25 | 1 evento |
| Primaria 2026 | 126 | 1 evento |
| Bachillerato 2026 | 189 | 1 evento |

**Columnas por sheet:**
```
Código | Grado | Nombre Completo | Nombre de la Madre | Email Madre | Nombre del Padre | Email Padre
+ columnas SI/NO/EXCUSA repetidas por cada evento (grupos de 3 columnas)
```

**Eventos en los headers (fila 1 antes del header real):**
```
Preescolar/Primaria 24-25:
  - 17/02/2024 (Póngase el morral)
  - 27/02/2024 (Asamblea)
  - 29/05/2024 Charla virtual responsabilidad parental
  - 31/08/2024 (Póngase el morral)
  - 18/09/2024 (charla virtual nuevos)
  - 25/09/2024 (charla virtual antiguos)
  - 15/02/2025 (Póngase el morral)
  - 25/02/2025 (Asamblea)
  - 19/03/2025 (charla virtual nuevos)
  - 26/03/2025 (charla virtual nuevos y antiguos)
  - 13/09/2025 (Póngase el morral)

Bachillerato 24-25:
  - 09/03/2024 Póngase el morral
  - 27/02/2024 (Asamblea)
  - 29/05/2024 Charla virtual responsabilidad parental
  - 07/09/2024 Póngase el morral
  - 18/09/2024 (charla virtual nuevos)
  - 25/09/2024 (charla virtual antiguos)
  - 22/02/2025 (Asamblea)
  - 08/03/2025 (Póngase el morral)
  - 19/03/2025 (charla virtual nuevos)
  - 26/03/2025 (charla virtual nuevos y antiguos)
  - 20/09/2025 (Póngase el morral)

Sheets 2026 (solo 1 evento cada una):
  - Preescolar: 14/02/2026 (Póngase el morral)
  - Bachillerato: 07/03/2026 (Póngase el morral)
  - Primaria: fecha en celda pero no en header visible
```

**Notas de parseo:**
- El header real de los datos está en la **fila 4** (índice 3), no en la fila 0
- Los nombres de eventos están en la **fila 2** (índice 1)
- Las columnas SI/NO/EXCUSA se repiten y pandas les agrega sufijos `.1`, `.2`, etc.
- Para parsear, leer `header=None`, detectar la fila que contiene "Código" y "Grado" como header real, y la fila anterior como fila de eventos
- Los valores de asistencia son: `SI`, `NO`, `EXCUSA`, `x`, `X`, o celdas vacías (= NO)
- Los sheets 2026 tienen el header en fila 5 (índice 4)

---

### Archivo 2: `Citas_de_información_2026.xlsx`

CRM de **prospectos** para el año 2026. Contiene citas informativas y sus seguimientos.

**Sheets:**

#### `Primaria - Preescolar` (82 filas) y `Bachillerato` (69 filas)

Mismas columnas en ambas:
```
Unnamed: 0         → flag de estado interno (valores: OK1, OK2, OK3, OK4, ok1, ok2, ok3, ok4, ok 1, ok 3)
Nombre Estudiante
Nombre de acudiente
Contacto           → teléfono (número)
Grado
Mes fecha de info  → mes en texto (Enero, Febrero...)
Fecha              → fecha completa datetime
Asistió            → SI / NO
Correo             → email del acudiente
Observaciones      → texto libre (¡OJO: en algunas filas tiene año "2026" como valor, es basura)
Grados perdidos    → texto libre (¡OJO: también tiene valores como "crm", "PAUTA", "whatsapp" — es basura de otra columna que se corrió)
Tipo de Contacto   → Whatsapp / Llamada / Virtual / (valores inconsistentes en Bachillerato, ver abajo)
Como llegó al colegio?   → canal de llegada
Contacto desde los mejores colegios  → bool/texto, si vino del portal "Los mejores colegios"
```

**Valores del flag `Unnamed: 0`:**
Parece indicar cuántos seguimientos tiene el prospecto (OK1 = 1 seguimiento, OK2 = 2, etc.). No documentado formalmente.

**Valores de `Tipo de Contacto` en Bachillerato (muy sucios):**
```
"por recomendación", "RECOMENDADO", "Por redes sociales en Instagram",
"Nos contaron", "Recomendación Psicóloga y Psiquiatra.", "Virtual",
"Ya asistió a cita de primaria", etc.
```
En este campo para Bachillerato, el dato real es el **canal de llegada**, no el tipo de contacto. Al migrar, mover estos valores al campo `canal_llegada` en `prospecto`.

#### `Seguimiento Preescolar` (24 filas), `Seguimiento Primaria` (29 filas), `Seguimiento Bachillerato` (41 filas)

Header en **dos filas** (fila 0 y fila 1), los datos empiezan en fila 2.

**Estructura del header doble:**

| Col 0 | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 | Col 7 | Col 8 | Col 9 | Col 10 | Col 11 | Col 12 | Col 13 | Col 14 | Col 15 | Col 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Fecha cita | Nombre del estudiante | Grado | Fecha de nacimiento* | Edad* | Acudiente | Telefono de contacto | Contacto 1 | | | Contacto 2 recepción | | | Contacto 3 | | | Estado del proceso |
| | | | | | | | Fecha | medio | observación | Fecha | medio | observación | Fecha | medio | observación | |

*`Fecha de nacimiento` y `Edad` solo existen en `Seguimiento Preescolar`, no en Primaria ni Bachillerato.

**Al parsear:** leer `header=None`, combinar filas 0 y 1 para construir nombres de columnas únicos:
```
fecha_cita, nombre_estudiante, grado, [fecha_nacimiento, edad,] acudiente, telefono,
contacto1_fecha, contacto1_medio, contacto1_observacion,
contacto2_fecha, contacto2_medio, contacto2_observacion,
contacto3_fecha, contacto3_medio, contacto3_observacion,
estado_proceso
```
Luego **pivotar** los 3 grupos de contacto a filas individuales en la tabla `seguimiento`.

---

### Archivo 3: `Citas_individuales.xlsx`

Registro de **citas individuales** (proceso de admisión) del año 2025. Fragmentado por asesor.

**Sheets:**

| Sheet | Filas | Asesor implícito |
|---|---|---|
| Preescolar | 38 | Sin asesor explícito |
| Bachillerato Adriana | 21 | Adriana |
| Bachillerato Eliana | 63 | Eliana |
| Bachillerato Rosita | 7 | Rosita |

**Columnas Preescolar:**
```
Mes | Día | Estudiante | Grado | Como conoció el colegio | Inicio proceso | Observación | Admitido | Matrícula | Estado del proceso
```

**Columnas Bachillerato Adriana / Eliana:**
```
Mes | Día | Estudiante | Grado | Como conoció el colegio | Inicio proceso | Pruebas | Observación | Admitido | Matrícula | Estado del proceso
```

**Columnas Bachillerato Rosita** (tiene columna extra):
```
Mes | Día | Estudiante | Grado | Como conoció el colegio | Inicio proceso | Pruebas | Observación | Admitido | Matrícula | Estado del proceso | Observaciones
```

**Notas:**
- `Pruebas` no existe en Preescolar — al migrar, dejar `NULL`
- `Observaciones` extra en Rosita = segunda columna de notas
- El asesor no está en los datos — inferirlo del nombre del sheet
- `Inicio proceso`, `Pruebas`, `Observación`, `Admitido`, `Matrícula` tienen valores: `SI`, `NO`, o fecha datetime
- El `Día` es datetime

---

### Archivo 4: `Embudo_2023_2024_y_2025-Final.xlsx`

Histórico de **3 años** del embudo de admisiones (2023, 2024, 2025). El más completo.

**Sheets de datos:**

| Sheet | Filas | Nivel |
|---|---|---|
| Datos Preescolar | 188 | Preescolar |
| Datos Primaria | 312 | Primaria |
| Datos Bachillerato | 478 | Bachillerato |

**Columnas Datos Preescolar:**
```
Unnamed: 0         → número de fila interna (ignorar)
Mes                → mes en texto
Día                → fecha datetime de la cita de información
Estudiante         → nombre completo
Grado              → grado al que aplica
Como conoció el colegio  → canal de llegada
Inicio proceso     → SI / fecha / NaN
Observación        → fecha de la observación/pasantía
Matrícula          → fecha de matrícula
Estado del proceso → texto libre (ver catálogo abajo)
Observaciones      → notas adicionales
Días entre cita de info e inicio de observa   → número calculado (NO migrar, recalcular en DB)
Días entre inici de observa y matrícula       → número calculado (NO migrar)
Días entre cita de info y matrícula           → número calculado (NO migrar)
```

**Columnas adicionales en Datos Primaria y Bachillerato:**
```
+ Pruebas          → fecha de pruebas (entre cita de info y observación)
+ Días entre cita de info e inicio de pruebas  → calculado (NO migrar)
+ Días entre pruebas y observa                 → calculado (NO migrar)
```

**Notas de parseo:**
- A partir de la columna 16 aprox., hay columnas con nombres que son números float (promedios del embudo pegados a los datos). **Ignorar todo desde la columna 16 en adelante.**
- La columna `Unnamed: 0` es basura interna, ignorar.
- `Inicio proceso` puede ser `SI`, una fecha datetime, o `NaN`
- Las fechas (`Pruebas`, `Observación`, `Matrícula`) pueden ser datetime o `NaT`

**Sheets que NO migrar (son reportes derivados, se reconstruyen con queries):**
```
Preescolar, Primaria, Bachillerato → conteos mensuales
General, General2 → consolidados
Resumen, Resumen 2023 - ERROR, Resumen2 → resúmenes anuales
comparativo semestre, comparativo trimestre → pivots
gráfico → labels de gráfico vacíos
```

---

## Catálogo de normalización — Canal de llegada

El campo `Como conoció el colegio` / `Como llegó al colegio` contiene ~200 valores distintos. Normalizar a estas categorías:

| Categoría normalizada | Ejemplos de valores originales |
|---|---|
| `referido_familia` | "Referido", "Referido ", "referido", "Referido familia Higuita Montoya", "Referido familia Elias Ortíz" |
| `referido_egresado` | "Referido egresado Nicolás Rueda", "Egresada del colegio", "Ex alumno", "Padre egresado del colegio" |
| `referido_profesional` | "Referido psicologa", "Referido Neuropsicologa", "Referido Dra.Johana Martínez", "Referido psiquiatra" |
| `referido_rector_docente` | "Referido rectora Montessori", "Referido rector del jardín", "Referido rectora el encuentro" |
| `internet` | "Internet", "internet", "Búsqueda personal", "Buscando" |
| `redes_sociales` | "Redes sociales", "Buscando en redes", "Anuncio en instagram" |
| `feria` | "Feria Conocer", "Feria conocer", "Internet-feria conocer" |
| `crm` | "CRM", "crm", "CRM y referido" |
| `vecinos` | "Vecinos del sector", "Vecinosdelsector", "paso por la vía", "Pasaron por el sector" |
| `conoce_tiempo_atras` | "Lo conoce tiempo atrás", "Ya lo conocían", "La mamá siempre lo ha conocido" |
| `otro_colegio` | "Colegio Alemán", "Colombo Britanico", "Columbus School", "La Colina" |
| `otros` | Cualquier valor que no encaje en las categorías anteriores |

La tabla `canal_llegada_cat` almacena el mapeo `valor_original → categoría` para auditoría.

---

## Catálogo de normalización — Grados

Normalizar todos los valores de grado a estos tokens estándar:

| Token estándar | Valores originales |
|---|---|
| `PREJARDÍN` | "Prejardín", "Prejardín " |
| `JARDÍN` | "Jardín", "Jardin", "jardín", "Jardín " |
| `TRANSICIÓN` | "Transición", "Transicion" |
| `1°` | "1°" |
| `2°` | "2°" |
| `3°` | "3°" |
| `4°` | "4°" |
| `5°` | "5°" |
| `6°` | "6°" |
| `7°` | "7°" |
| `8°` | "8°" |
| `9°` | "9°" |
| `10°` | "10°" |
| `11°` | "11°" |
| `MÚLTIPLE` | "1° y 5°", "6° y 7°", "Jardín y 2°", "Trans. y 5°", "3° y 1°", etc. |

Los grados múltiples (un prospecto que aplica para más de un grado) se almacenan en la columna `grado_secundario` del prospecto.

---

## Catálogo de normalización — Estado del proceso

Normalizar el campo `Estado del proceso` a estas categorías:

| Categoría | Descripción |
|---|---|
| `matriculado` | "Matrícula", "Matricula", "por matricular", "Cupo reservado" |
| `no_admitido` | "No admitido", "No admitida", "No admitido a pasantía", "No se admite a pasantía" |
| `desiste` | Cualquier variante de "Desiste del proceso", "Desisten del proceso" |
| `no_continua_costos` | "No continuan por los costos", "No desea continuar por costos", "No desea iniciar proceso por temas económicos" |
| `no_responde` | "No responde", "No responden", "Se hace contacto y no responde" |
| `otro_colegio` | "Optaron por otro colegio", "Proceso en otro colegio", "Se quedarán en el colegio actual" |
| `edad_insuficiente` | "Tiene 1 año", "Tiene 2 años", "En gestación", "Bebé de 4 meses" |
| `necesidades_especiales` | "Autismo nivel 1", "Autismo severo", "Estudiante con necesidades especiales" |
| `proceso_futuro` | "Desean proceso más adelante", "Ingreso 2026", "cupo 2027", "Desean proceso para 2026" |
| `pensando` | "Aún no toman la decisión", "Mirando otras opciones", "Validando otras opciones" |
| `pendiente` | "Pendiente por entregar pruebas", null |

---

## Esquema de la base de datos PostgreSQL

### Tabla: `estudiante`
```sql
CREATE TABLE estudiante (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno  VARCHAR(20),          -- del archivo morral
  nombre_completo VARCHAR(200) NOT NULL,
  grado           VARCHAR(20),
  nivel           VARCHAR(20),          -- PREESCOLAR, PRIMARIA, BACHILLERATO
  anio_ingreso    INTEGER,
  origen_archivo  VARCHAR(50),          -- para trazabilidad de la migración
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `acudiente`
```sql
CREATE TABLE acudiente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo VARCHAR(200) NOT NULL,
  email           VARCHAR(200),
  telefono        VARCHAR(30),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `estudiante_acudiente` (relación muchos a muchos)
```sql
CREATE TABLE estudiante_acudiente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_estudiante   UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  id_acudiente    UUID NOT NULL REFERENCES acudiente(id) ON DELETE CASCADE,
  relacion        VARCHAR(20),   -- MADRE, PADRE, OTRO
  orden           INTEGER,       -- 1 = acudiente principal, 2 = secundario
  UNIQUE(id_estudiante, id_acudiente)
);
```

### Tabla: `canal_llegada_cat` (lookup de normalización)
```sql
CREATE TABLE canal_llegada_cat (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valor_original    VARCHAR(500) UNIQUE NOT NULL,
  categoria         VARCHAR(50) NOT NULL,  -- ver catálogo arriba
  referido_nombre   VARCHAR(200)           -- si es referido, el nombre de la persona
);
```

### Tabla: `prospecto`
```sql
CREATE TABLE prospecto (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_estudiante            UUID REFERENCES estudiante(id),
  anio_proceso             INTEGER NOT NULL,   -- 2023, 2024, 2025, 2026
  canal_llegada            VARCHAR(50),        -- categoría normalizada
  canal_llegada_original   VARCHAR(500),       -- valor crudo del Excel
  referido_nombre          VARCHAR(200),       -- si canal = referido_*
  asesor                   VARCHAR(100),       -- Adriana, Eliana, Rosita, o NULL
  grado_primario           VARCHAR(20),
  grado_secundario         VARCHAR(20),        -- cuando aplica a 2 grados
  nivel                    VARCHAR(20),        -- PREESCOLAR, PRIMARIA, BACHILLERATO
  estado_proceso_cat       VARCHAR(30),        -- categoría normalizada
  estado_proceso_original  TEXT,               -- texto crudo
  observaciones            TEXT,
  flag_ok                  VARCHAR(10),        -- OK1, OK2, OK3, OK4 del archivo citas 2026
  contacto_mejores_colegios BOOLEAN DEFAULT FALSE,
  mes_cita                 VARCHAR(20),
  origen_archivo           VARCHAR(50),        -- trazabilidad
  created_at               TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `cita_informacion`
```sql
CREATE TABLE cita_informacion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_prospecto    UUID NOT NULL REFERENCES prospecto(id) ON DELETE CASCADE,
  fecha           DATE,
  asistio         BOOLEAN,
  tipo_contacto   VARCHAR(50),   -- Whatsapp, Llamada, Virtual
  observaciones   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `seguimiento`
```sql
CREATE TABLE seguimiento (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_prospecto    UUID NOT NULL REFERENCES prospecto(id) ON DELETE CASCADE,
  numero_contacto INTEGER NOT NULL,   -- 1, 2, 3
  fecha           DATE,
  medio           VARCHAR(100),       -- Whatsapp, Llamada, Email, etc.
  observacion     TEXT,
  fecha_nacimiento DATE,              -- solo existe en datos de Preescolar
  edad            DECIMAL(5,2),       -- calculado al momento de la cita
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `etapa_proceso`
```sql
CREATE TABLE etapa_proceso (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_prospecto    UUID NOT NULL REFERENCES prospecto(id) ON DELETE CASCADE,
  etapa           VARCHAR(30) NOT NULL,
  -- valores: INICIO_PROCESO, PRUEBAS, OBSERVACION, MATRICULA
  fecha           DATE,
  completada      BOOLEAN DEFAULT FALSE,
  admitido        BOOLEAN,    -- para etapa OBSERVACION y MATRICULA
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `evento_institucional`
```sql
CREATE TABLE evento_institucional (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          VARCHAR(200) NOT NULL,
  fecha           DATE NOT NULL,
  tipo            VARCHAR(50),
  -- valores: PONGASE_EL_MORRAL, ASAMBLEA, CHARLA_VIRTUAL_NUEVOS, CHARLA_VIRTUAL_ANTIGUOS, CHARLA_VIRTUAL_TODOS
  nivel           VARCHAR(20),        -- PREESCOLAR, PRIMARIA, BACHILLERATO, TODOS
  anio_escolar    VARCHAR(10),        -- '24-25', '2026'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `asistencia_evento`
```sql
CREATE TABLE asistencia_evento (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_estudiante   UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  id_evento       UUID NOT NULL REFERENCES evento_institucional(id) ON DELETE CASCADE,
  resultado       VARCHAR(10) NOT NULL,   -- SI, NO, EXCUSA
  excusa          TEXT,
  UNIQUE(id_estudiante, id_evento)
);
```

---

## Script ETL — lógica de migración

### Orden de ejecución

```
1. Leer y normalizar canal_llegada → poblar canal_llegada_cat
2. Procesar archivo MORRAL → crear estudiante + acudiente(x2) + estudiante_acudiente + evento_institucional + asistencia_evento
3. Procesar archivo EMBUDO (histórico 2023-2025) → crear prospecto + cita_informacion + etapa_proceso
4. Procesar archivo CITAS INDIVIDUALES (2025) → enriquecer/crear prospecto + etapa_proceso (con asesor)
5. Procesar archivo CITAS INFO 2026 → crear prospecto + cita_informacion
6. Procesar SEGUIMIENTOS (sheets de seguimiento de Citas 2026) → crear seguimiento
```

### Lógica de deduplicación de estudiantes

Al migrar, un estudiante puede aparecer en múltiples archivos. La clave de deduplicación es:

```python
def estudiante_key(nombre: str, grado: str) -> str:
    nombre_norm = unidecode(nombre.strip().upper())
    grado_norm = normalizar_grado(grado)
    return f"{nombre_norm}|{grado_norm}"
```

Si el mismo key ya existe en la tabla `estudiante`, reusar el `id` existente en lugar de crear duplicado.

### Lógica de parseo del archivo MORRAL

```python
def parsear_morral_sheet(filepath, sheet_name):
    df_raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
    
    # 1. Encontrar fila del header real (contiene "Código" o "Código")
    header_row = None
    for i, row in df_raw.iterrows():
        if any(str(v) in ['Código', 'Codigo', 'Grado'] for v in row):
            header_row = i
            break
    
    # 2. Encontrar fila de eventos (fila inmediatamente antes del header con fechas)
    event_row = header_row - 1  # generalmente
    events = []
    col_offsets = []  # índices de columna donde empieza cada grupo SI/NO/EXCUSA
    for j, val in enumerate(df_raw.iloc[event_row]):
        if str(val) != 'nan' and j >= 7:  # primeras 7 cols son datos del estudiante
            events.append(str(val).strip())
            col_offsets.append(j)
    
    # 3. Leer datos con el header correcto
    df = pd.read_excel(filepath, sheet_name=sheet_name, header=header_row)
    df = df.dropna(how='all')
    
    return df, events, col_offsets
```

### Lógica de parseo del header doble en Seguimientos

```python
def parsear_seguimiento_sheet(filepath, sheet_name):
    df_raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
    
    row0 = df_raw.iloc[0].tolist()
    row1 = df_raw.iloc[1].tolist()
    
    # Construir nombres de columna combinando filas 0 y 1
    cols = []
    current_group = None
    for i, (r0, r1) in enumerate(zip(row0, row1)):
        r0 = str(r0).strip() if str(r0) != 'nan' else None
        r1 = str(r1).strip() if str(r1) != 'nan' else None
        
        if r0:
            current_group = r0
        
        if current_group in ['Contacto 1', 'Contacto 2 recepción', 'Contacto 3']:
            num = current_group.split()[1].replace('recepción', '2')
            num = '1' if 'Contacto 1' in current_group else '2' if 'recepción' in current_group else '3'
            cols.append(f"contacto{num}_{r1.lower().replace(' ', '_') if r1 else 'unknown'}")
        elif r0:
            cols.append(r0.lower().replace(' ', '_').replace('ó', 'o').replace('é', 'e'))
        else:
            cols.append(f"col_{i}")
    
    df = df_raw.iloc[2:].copy()
    df.columns = cols
    return df.dropna(how='all')
```

### Lógica de parseo del EMBUDO (columnas flotantes al final)

```python
def parsear_embudo_sheet(filepath, sheet_name):
    df = pd.read_excel(filepath, sheet_name=sheet_name, header=0)
    
    # Eliminar columnas con nombres que sean float (promedios pegados)
    valid_cols = [c for c in df.columns 
                  if not isinstance(c, float) 
                  and not str(c).replace('.', '').isdigit()
                  and not str(c).startswith('Unnamed: 1')
                  and not str(c).startswith('Unnamed: 2')]
    
    df = df[valid_cols]
    
    # Eliminar columna de índice interno
    if 'Unnamed: 0' in df.columns:
        df = df.drop(columns=['Unnamed: 0'])
    
    # Filtrar filas con nombre de estudiante vacío
    df = df.dropna(subset=['Estudiante'])
    
    return df
```

---

## Estructura del proyecto Next.js

```
/
├── prisma/
│   ├── schema.prisma          ← definición del schema
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx           ← Dashboard principal
│   │   ├── prospectos/
│   │   │   ├── page.tsx       ← Lista de prospectos con filtros
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx   ← Detalle de prospecto (historial completo)
│   │   │   └── nuevo/
│   │   │       └── page.tsx   ← Formulario nuevo prospecto
│   │   ├── estudiantes/
│   │   │   ├── page.tsx       ← Lista de estudiantes matriculados
│   │   │   └── [id]/
│   │   │       └── page.tsx   ← Detalle estudiante + asistencia a eventos
│   │   ├── eventos/
│   │   │   ├── page.tsx       ← Lista de eventos + asistencia
│   │   │   └── nuevo/
│   │   │       └── page.tsx
│   │   ├── reportes/
│   │   │   └── page.tsx       ← Embudo de conversión, canal de llegada, etc.
│   │   └── api/
│   │       ├── prospectos/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── seguimientos/
│   │       │           └── route.ts
│   │       ├── estudiantes/
│   │       │   └── route.ts
│   │       └── reportes/
│   │           └── embudo/
│   │               └── route.ts
│   ├── components/
│   │   ├── ProspectoCard.tsx
│   │   ├── SeguimientoForm.tsx
│   │   ├── EmbudoChart.tsx
│   │   └── AsistenciaTable.tsx
│   └── lib/
│       ├── prisma.ts          ← singleton del cliente Prisma
│       └── utils.ts
├── etl/
│   ├── requirements.txt
│   ├── migrate.py             ← script principal de migración
│   ├── parsers/
│   │   ├── morral.py
│   │   ├── citas_info.py
│   │   ├── citas_individuales.py
│   │   └── embudo.py
│   ├── normalizers/
│   │   ├── canal_llegada.py
│   │   ├── grados.py
│   │   └── estado_proceso.py
│   └── data/
│       ├── Base_de_datos_póngase_el_morral.xlsx
│       ├── Citas_de_información_2026.xlsx
│       ├── Citas_individuales.xlsx
│       └── Embudo_2023_2024_y_2025-Final.xlsx
└── package.json
```

---

## Vistas clave del frontend

### 1. Dashboard (`/`)
- Total prospectos por año (2023, 2024, 2025, 2026)
- Embudo actual: citas → inicio proceso → pruebas → observación → matrícula
- Conversión por canal de llegada (top 5)
- Conversión por asesor
- Próximas citas / seguimientos pendientes

### 2. Lista de prospectos (`/prospectos`)
Filtros: año, nivel (Preescolar/Primaria/Bachillerato), asesor, canal, estado, grado
Columnas: nombre, grado, fecha cita, asistió, estado, última actividad

### 3. Detalle de prospecto (`/prospectos/[id]`)
- Datos del estudiante y acudiente(s)
- Timeline de la cita de información
- Lista de seguimientos (con botón "+ Agregar seguimiento")
- Progreso por etapas: Cita → Pruebas → Observación → Matrícula
- Estado final

### 4. Lista de estudiantes matriculados (`/estudiantes`)
- Estudiantes del archivo morral
- Historial de asistencia a eventos por estudiante

### 5. Reportes (`/reportes`)
- Embudo mes a mes (bar chart)
- Días promedio entre etapas
- Canal de llegada más efectivo (pie/bar chart)
- Comparativo 2023 vs 2024 vs 2025

---

## Queries SQL útiles para los reportes

### Embudo de conversión por año y nivel
```sql
SELECT
  p.anio_proceso,
  p.nivel,
  COUNT(*) as total_citas,
  COUNT(CASE WHEN ep_inicio.id IS NOT NULL THEN 1 END) as inicio_proceso,
  COUNT(CASE WHEN ep_pruebas.id IS NOT NULL THEN 1 END) as pruebas,
  COUNT(CASE WHEN ep_obs.id IS NOT NULL THEN 1 END) as observacion,
  COUNT(CASE WHEN ep_mat.id IS NOT NULL THEN 1 END) as matricula
FROM prospecto p
LEFT JOIN etapa_proceso ep_inicio ON ep_inicio.id_prospecto = p.id AND ep_inicio.etapa = 'INICIO_PROCESO'
LEFT JOIN etapa_proceso ep_pruebas ON ep_pruebas.id_prospecto = p.id AND ep_pruebas.etapa = 'PRUEBAS'
LEFT JOIN etapa_proceso ep_obs ON ep_obs.id_prospecto = p.id AND ep_obs.etapa = 'OBSERVACION'
LEFT JOIN etapa_proceso ep_mat ON ep_mat.id_prospecto = p.id AND ep_mat.etapa = 'MATRICULA'
GROUP BY p.anio_proceso, p.nivel
ORDER BY p.anio_proceso, p.nivel;
```

### Días promedio entre etapas
```sql
SELECT
  p.nivel,
  p.anio_proceso,
  AVG(ep_pruebas.fecha - ci.fecha) as dias_cita_a_pruebas,
  AVG(ep_obs.fecha - ep_pruebas.fecha) as dias_pruebas_a_obs,
  AVG(ep_mat.fecha - ep_obs.fecha) as dias_obs_a_matricula,
  AVG(ep_mat.fecha - ci.fecha) as dias_cita_a_matricula
FROM prospecto p
JOIN cita_informacion ci ON ci.id_prospecto = p.id
LEFT JOIN etapa_proceso ep_pruebas ON ep_pruebas.id_prospecto = p.id AND ep_pruebas.etapa = 'PRUEBAS'
LEFT JOIN etapa_proceso ep_obs ON ep_obs.id_prospecto = p.id AND ep_obs.etapa = 'OBSERVACION'
LEFT JOIN etapa_proceso ep_mat ON ep_mat.id_prospecto = p.id AND ep_mat.etapa = 'MATRICULA'
GROUP BY p.nivel, p.anio_proceso;
```

### Efectividad por canal
```sql
SELECT
  p.canal_llegada,
  COUNT(*) as total,
  COUNT(CASE WHEN ep_mat.id IS NOT NULL THEN 1 END) as matriculados,
  ROUND(COUNT(CASE WHEN ep_mat.id IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 1) as tasa_conversion
FROM prospecto p
LEFT JOIN etapa_proceso ep_mat ON ep_mat.id_prospecto = p.id AND ep_mat.etapa = 'MATRICULA'
WHERE p.canal_llegada IS NOT NULL
GROUP BY p.canal_llegada
ORDER BY tasa_conversion DESC;
```

---

## Variables de entorno requeridas

```env
# .env.local
DATABASE_URL="postgresql://user:password@host:5432/fontan_db"
DIRECT_URL="postgresql://user:password@host:5432/fontan_db"  # para Prisma migrations en Supabase
```

---

## Consideraciones importantes para la migración

1. **No perder ningún dato**: guardar siempre el valor original en campos `*_original` antes de normalizar

2. **Columna `Observaciones` vs `Observación`**: en algunos sheets es la etapa del proceso (fecha datetime), en otros es texto libre de notas. Distinguir por dtype: si es datetime → etapa, si es texto → notas

3. **Columna `Inicio proceso`**: puede ser `SI` (booleano) o una fecha datetime. Si es fecha, esa fecha es cuando inició el proceso. Si es `SI` sin fecha, usar la fecha de la cita como fecha de inicio

4. **`Grados perdidos` en Citas 2026**: ese campo tiene basura mezclada (valores de otras columnas que se corrieron en el Excel original). Al migrar, intentar separar los valores que parezcan grados reales ("3°", "repitió 2°") de los que son claramente ruido ("crm", "PAUTA", "whatsapp")

5. **Trazabilidad**: el campo `origen_archivo` en `prospecto` y `estudiante` debe indicar de qué archivo y sheet vino cada registro (ej: `"embudo:Datos Bachillerato"`, `"citas_info:Primaria - Preescolar"`)

6. **Duplicados entre archivos**: un mismo estudiante puede aparecer en el EMBUDO 2025 y también en CITAS INDIVIDUALES 2025. La deduplicación por `nombre_completo + grado` es la única forma disponible (no hay ID único en los Excel)

7. **Asesores en Citas Individuales**: el nombre del asesor se infiere del nombre del sheet. Para el sheet "Preescolar" y los 3 de Bachillerato, el nivel también se infiere del nombre del sheet

8. **Eventos del Morral**: crear primero todos los eventos únicos en `evento_institucional`, luego crear la asistencia. Para los sheets 2026 con solo 1 evento, el nombre del evento puede estar en la celda del header o inferirse del patrón ("Póngase el morral" + fecha)
