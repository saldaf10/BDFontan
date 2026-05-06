"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { booleanValue, dateValue, intValue, stringValue } from "@/lib/form";

export async function createProspecto(formData: FormData) {
  const nombreCompleto = stringValue(formData, "nombreCompleto");
  const anioProceso = intValue(formData, "anioProceso");

  if (!nombreCompleto || !anioProceso) {
    throw new Error("Nombre completo y año del proceso son obligatorios");
  }

  const grado = stringValue(formData, "gradoPrimario");
  const nivel = stringValue(formData, "nivel");

  const prospecto = await prisma.prospecto.create({
    data: {
      anioProceso,
      canalLlegada: stringValue(formData, "canalLlegada"),
      canalLlegadaOriginal: stringValue(formData, "canalLlegadaOriginal"),
      referidoNombre: stringValue(formData, "referidoNombre"),
      asesor: stringValue(formData, "asesor"),
      gradoPrimario: grado,
      gradoSecundario: stringValue(formData, "gradoSecundario"),
      nivel,
      estadoProcesoCat: stringValue(formData, "estadoProcesoCat") ?? "pendiente",
      estadoProcesoOriginal: stringValue(formData, "estadoProcesoOriginal"),
      observaciones: stringValue(formData, "observaciones"),
      mesCita: stringValue(formData, "mesCita"),
      flagOk: stringValue(formData, "flagOk"),
      contactoMejoresColegios: formData.get("contactoMejoresColegios") === "on",
      origenArchivo: "manual:prospectos",
      estudiante: {
        create: {
          nombreCompleto,
          grado,
          nivel,
          origenArchivo: "manual:prospectos"
        }
      },
      citasInformacion: {
        create: {
          fecha: dateValue(formData, "fechaCita"),
          asistio: booleanValue(formData, "asistio"),
          tipoContacto: stringValue(formData, "tipoContacto"),
          observaciones: stringValue(formData, "observacionesCita")
        }
      }
    }
  });

  revalidatePath("/prospectos");
  redirect(`/prospectos/${prospecto.id}`);
}

export async function updateProspecto(prospectoId: string, formData: FormData) {
  const nombreCompleto = stringValue(formData, "nombreCompleto");
  const grado = stringValue(formData, "gradoPrimario");
  const nivel = stringValue(formData, "nivel");

  const prospecto = await prisma.prospecto.update({
    where: { id: prospectoId },
    data: {
      anioProceso: intValue(formData, "anioProceso") ?? undefined,
      canalLlegada: stringValue(formData, "canalLlegada"),
      canalLlegadaOriginal: stringValue(formData, "canalLlegadaOriginal"),
      referidoNombre: stringValue(formData, "referidoNombre"),
      asesor: stringValue(formData, "asesor"),
      gradoPrimario: grado,
      gradoSecundario: stringValue(formData, "gradoSecundario"),
      nivel,
      estadoProcesoCat: stringValue(formData, "estadoProcesoCat"),
      estadoProcesoOriginal: stringValue(formData, "estadoProcesoOriginal"),
      observaciones: stringValue(formData, "observaciones"),
      mesCita: stringValue(formData, "mesCita"),
      flagOk: stringValue(formData, "flagOk"),
      contactoMejoresColegios: formData.get("contactoMejoresColegios") === "on",
      estudiante: nombreCompleto
        ? {
            update: {
              nombreCompleto,
              grado,
              nivel
            }
          }
        : undefined
    }
  });

  const fechaCita = dateValue(formData, "fechaCita");
  const asistio = booleanValue(formData, "asistio");
  const tipoContacto = stringValue(formData, "tipoContacto");
  const observacionesCita = stringValue(formData, "observacionesCita");
  const firstCita = await prisma.citaInformacion.findFirst({
    where: { idProspecto: prospectoId },
    orderBy: { fecha: "asc" }
  });

  if (firstCita) {
    await prisma.citaInformacion.update({
      where: { id: firstCita.id },
      data: {
        fecha: fechaCita,
        asistio,
        tipoContacto,
        observaciones: observacionesCita
      }
    });
  } else if (fechaCita || asistio !== null || tipoContacto || observacionesCita) {
    await prisma.citaInformacion.create({
      data: {
        idProspecto: prospectoId,
        fecha: fechaCita,
        asistio,
        tipoContacto,
        observaciones: observacionesCita
      }
    });
  }

  revalidatePath("/prospectos");
  revalidatePath(`/prospectos/${prospecto.id}`);
  redirect(`/prospectos/${prospecto.id}`);
}

export async function createSeguimiento(prospectoId: string, formData: FormData) {
  await prisma.seguimiento.create({
    data: {
      idProspecto: prospectoId,
      numeroContacto: intValue(formData, "numeroContacto") ?? 1,
      fecha: dateValue(formData, "fecha"),
      medio: stringValue(formData, "medio"),
      observacion: stringValue(formData, "observacion")
    }
  });

  revalidatePath(`/prospectos/${prospectoId}`);
}

export async function upsertEtapa(prospectoId: string, formData: FormData) {
  const etapa = stringValue(formData, "etapa");
  if (!etapa) {
    throw new Error("La etapa es obligatoria");
  }

  const existing = await prisma.etapaProceso.findFirst({
    where: { idProspecto: prospectoId, etapa }
  });

  const data = {
    fecha: dateValue(formData, "fecha"),
    completada: formData.get("completada") === "on",
    admitido: booleanValue(formData, "admitido")
  };

  if (existing) {
    await prisma.etapaProceso.update({ where: { id: existing.id }, data });
  } else {
    await prisma.etapaProceso.create({
      data: {
        idProspecto: prospectoId,
        etapa,
        ...data
      }
    });
  }

  revalidatePath(`/prospectos/${prospectoId}`);
}

export async function createEvento(formData: FormData) {
  const nombre = stringValue(formData, "nombre");
  const fecha = dateValue(formData, "fecha");

  if (!nombre || !fecha) {
    throw new Error("Nombre y fecha son obligatorios");
  }

  const evento = await prisma.eventoInstitucional.create({
    data: {
      nombre,
      fecha,
      tipo: stringValue(formData, "tipo"),
      nivel: stringValue(formData, "nivel"),
      anioEscolar: stringValue(formData, "anioEscolar")
    }
  });

  revalidatePath("/eventos");
  redirect(`/eventos/${evento.id}`);
}

export async function updateEvento(eventoId: string, formData: FormData) {
  const nombre = stringValue(formData, "nombre");
  const fecha = dateValue(formData, "fecha");

  if (!nombre || !fecha) {
    throw new Error("Nombre y fecha son obligatorios");
  }

  await prisma.eventoInstitucional.update({
    where: { id: eventoId },
    data: {
      nombre,
      fecha,
      tipo: stringValue(formData, "tipo"),
      nivel: stringValue(formData, "nivel"),
      anioEscolar: stringValue(formData, "anioEscolar")
    }
  });

  revalidatePath("/eventos");
  revalidatePath(`/eventos/${eventoId}`);
}

export async function recordAsistencia(eventoId: string, estudianteId: string, formData: FormData) {
  const resultado = stringValue(formData, "resultado") ?? "SI";
  const excusa = stringValue(formData, "excusa");

  await prisma.asistenciaEvento.upsert({
    where: {
      idEstudiante_idEvento: {
        idEstudiante: estudianteId,
        idEvento: eventoId
      }
    },
    create: {
      idEstudiante: estudianteId,
      idEvento: eventoId,
      resultado,
      excusa: resultado === "EXCUSA" ? excusa : null
    },
    update: {
      resultado,
      excusa: resultado === "EXCUSA" ? excusa : null
    }
  });

  revalidatePath(`/eventos/${eventoId}`);
  revalidatePath(`/estudiantes/${estudianteId}`);
}

export async function deleteAsistencia(asistenciaId: string, eventoId: string) {
  await prisma.asistenciaEvento.delete({ where: { id: asistenciaId } });
  revalidatePath(`/eventos/${eventoId}`);
}

export async function createCitaInformacion(prospectoId: string, formData: FormData) {
  await prisma.citaInformacion.create({
    data: {
      idProspecto: prospectoId,
      fecha: dateValue(formData, "fecha"),
      asistio: booleanValue(formData, "asistio"),
      tipoContacto: stringValue(formData, "tipoContacto"),
      observaciones: stringValue(formData, "observaciones")
    }
  });

  revalidatePath(`/prospectos/${prospectoId}`);
}

export async function updateCitaInformacion(citaId: string, prospectoId: string, formData: FormData) {
  await prisma.citaInformacion.update({
    where: { id: citaId },
    data: {
      fecha: dateValue(formData, "fecha"),
      asistio: booleanValue(formData, "asistio"),
      tipoContacto: stringValue(formData, "tipoContacto"),
      observaciones: stringValue(formData, "observaciones")
    }
  });

  revalidatePath(`/prospectos/${prospectoId}`);
}

export async function deleteCitaInformacion(citaId: string, prospectoId: string) {
  await prisma.citaInformacion.delete({ where: { id: citaId } });
  revalidatePath(`/prospectos/${prospectoId}`);
}

export async function updateEstudiante(estudianteId: string, formData: FormData) {
  const nombreCompleto = stringValue(formData, "nombreCompleto");
  if (!nombreCompleto) {
    throw new Error("El nombre es obligatorio");
  }

  await prisma.estudiante.update({
    where: { id: estudianteId },
    data: {
      nombreCompleto,
      codigoInterno: stringValue(formData, "codigoInterno"),
      grado: stringValue(formData, "grado"),
      nivel: stringValue(formData, "nivel"),
      anioIngreso: intValue(formData, "anioIngreso"),
      origenArchivo: stringValue(formData, "origenArchivo")
    }
  });

  revalidatePath("/estudiantes");
  revalidatePath(`/estudiantes/${estudianteId}`);
  redirect(`/estudiantes/${estudianteId}`);
}

export async function addAcudienteToEstudiante(estudianteId: string, formData: FormData) {
  const nombreCompleto = stringValue(formData, "nombreAcudiente");
  if (!nombreCompleto) {
    throw new Error("Nombre del acudiente obligatorio");
  }

  const acudiente = await prisma.acudiente.create({
    data: {
      nombreCompleto,
      email: stringValue(formData, "emailAcudiente"),
      telefono: stringValue(formData, "telefonoAcudiente")
    }
  });

  await prisma.estudianteAcudiente.upsert({
    where: {
      idEstudiante_idAcudiente: {
        idEstudiante: estudianteId,
        idAcudiente: acudiente.id
      }
    },
    create: {
      idEstudiante: estudianteId,
      idAcudiente: acudiente.id,
      relacion: stringValue(formData, "relacion") ?? "OTRO",
      orden: intValue(formData, "orden") ?? 3
    },
    update: {
      relacion: stringValue(formData, "relacion") ?? undefined,
      orden: intValue(formData, "orden") ?? undefined
    }
  });

  revalidatePath(`/estudiantes/${estudianteId}`);
}
