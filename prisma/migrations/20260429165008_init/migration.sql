-- CreateTable
CREATE TABLE "estudiante" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo_interno" VARCHAR(20),
    "nombre_completo" VARCHAR(200) NOT NULL,
    "grado" VARCHAR(20),
    "nivel" VARCHAR(20),
    "anio_ingreso" INTEGER,
    "origen_archivo" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acudiente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre_completo" VARCHAR(200) NOT NULL,
    "email" VARCHAR(200),
    "telefono" VARCHAR(30),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acudiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudiante_acudiente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_estudiante" UUID NOT NULL,
    "id_acudiente" UUID NOT NULL,
    "relacion" VARCHAR(20),
    "orden" INTEGER,

    CONSTRAINT "estudiante_acudiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canal_llegada_cat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "valor_original" VARCHAR(500) NOT NULL,
    "categoria" VARCHAR(50) NOT NULL,
    "referido_nombre" VARCHAR(200),

    CONSTRAINT "canal_llegada_cat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospecto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_estudiante" UUID,
    "anio_proceso" INTEGER NOT NULL,
    "canal_llegada" VARCHAR(50),
    "canal_llegada_original" VARCHAR(500),
    "referido_nombre" VARCHAR(200),
    "asesor" VARCHAR(100),
    "grado_primario" VARCHAR(20),
    "grado_secundario" VARCHAR(20),
    "nivel" VARCHAR(20),
    "estado_proceso_cat" VARCHAR(30),
    "estado_proceso_original" TEXT,
    "observaciones" TEXT,
    "flag_ok" VARCHAR(10),
    "contacto_mejores_colegios" BOOLEAN NOT NULL DEFAULT false,
    "mes_cita" VARCHAR(20),
    "origen_archivo" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cita_informacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_prospecto" UUID NOT NULL,
    "fecha" DATE,
    "asistio" BOOLEAN,
    "tipo_contacto" VARCHAR(50),
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cita_informacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguimiento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_prospecto" UUID NOT NULL,
    "numero_contacto" INTEGER NOT NULL,
    "fecha" DATE,
    "medio" VARCHAR(100),
    "observacion" TEXT,
    "fecha_nacimiento" DATE,
    "edad" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapa_proceso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_prospecto" UUID NOT NULL,
    "etapa" VARCHAR(30) NOT NULL,
    "fecha" DATE,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "admitido" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etapa_proceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_institucional" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(200) NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" VARCHAR(50),
    "nivel" VARCHAR(20),
    "anio_escolar" VARCHAR(10),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_institucional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencia_evento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_estudiante" UUID NOT NULL,
    "id_evento" UUID NOT NULL,
    "resultado" VARCHAR(10) NOT NULL,
    "excusa" TEXT,

    CONSTRAINT "asistencia_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estudiante_nombre_completo_grado_idx" ON "estudiante"("nombre_completo", "grado");

-- CreateIndex
CREATE INDEX "acudiente_email_idx" ON "acudiente"("email");

-- CreateIndex
CREATE UNIQUE INDEX "estudiante_acudiente_id_estudiante_id_acudiente_key" ON "estudiante_acudiente"("id_estudiante", "id_acudiente");

-- CreateIndex
CREATE UNIQUE INDEX "canal_llegada_cat_valor_original_key" ON "canal_llegada_cat"("valor_original");

-- CreateIndex
CREATE INDEX "prospecto_anio_proceso_nivel_idx" ON "prospecto"("anio_proceso", "nivel");

-- CreateIndex
CREATE INDEX "prospecto_canal_llegada_idx" ON "prospecto"("canal_llegada");

-- CreateIndex
CREATE INDEX "prospecto_estado_proceso_cat_idx" ON "prospecto"("estado_proceso_cat");

-- CreateIndex
CREATE INDEX "cita_informacion_fecha_idx" ON "cita_informacion"("fecha");

-- CreateIndex
CREATE INDEX "seguimiento_id_prospecto_numero_contacto_idx" ON "seguimiento"("id_prospecto", "numero_contacto");

-- CreateIndex
CREATE INDEX "etapa_proceso_etapa_fecha_idx" ON "etapa_proceso"("etapa", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "evento_institucional_nombre_fecha_nivel_anio_escolar_key" ON "evento_institucional"("nombre", "fecha", "nivel", "anio_escolar");

-- CreateIndex
CREATE UNIQUE INDEX "asistencia_evento_id_estudiante_id_evento_key" ON "asistencia_evento"("id_estudiante", "id_evento");

-- AddForeignKey
ALTER TABLE "estudiante_acudiente" ADD CONSTRAINT "estudiante_acudiente_id_estudiante_fkey" FOREIGN KEY ("id_estudiante") REFERENCES "estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiante_acudiente" ADD CONSTRAINT "estudiante_acudiente_id_acudiente_fkey" FOREIGN KEY ("id_acudiente") REFERENCES "acudiente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospecto" ADD CONSTRAINT "prospecto_id_estudiante_fkey" FOREIGN KEY ("id_estudiante") REFERENCES "estudiante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita_informacion" ADD CONSTRAINT "cita_informacion_id_prospecto_fkey" FOREIGN KEY ("id_prospecto") REFERENCES "prospecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_id_prospecto_fkey" FOREIGN KEY ("id_prospecto") REFERENCES "prospecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapa_proceso" ADD CONSTRAINT "etapa_proceso_id_prospecto_fkey" FOREIGN KEY ("id_prospecto") REFERENCES "prospecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_evento" ADD CONSTRAINT "asistencia_evento_id_estudiante_fkey" FOREIGN KEY ("id_estudiante") REFERENCES "estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia_evento" ADD CONSTRAINT "asistencia_evento_id_evento_fkey" FOREIGN KEY ("id_evento") REFERENCES "evento_institucional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
