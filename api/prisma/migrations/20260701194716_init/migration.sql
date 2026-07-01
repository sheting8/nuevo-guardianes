-- CreateEnum
CREATE TYPE "TipoVoluntario" AS ENUM ('QUINCE', 'CONFEDERADO');

-- CreateEnum
CREATE TYPE "RolSistema" AS ENUM ('ADMIN', 'JEFE_GUARDIA', 'GUARDIAN', 'CONDUCTOR', 'OFICIALIDAD');

-- CreateEnum
CREATE TYPE "TipoPermiso" AS ENUM ('PERMISO', 'PERMISO_ESPECIAL', 'REEMPLAZO');

-- CreateEnum
CREATE TYPE "EstadoPermiso" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voluntario" (
    "id" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "tipo" "TipoVoluntario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "nombres" TEXT NOT NULL,
    "apellidoP" TEXT NOT NULL,
    "apellidoM" TEXT,
    "rut" TEXT NOT NULL,
    "rutDigito" TEXT NOT NULL,
    "company" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,

    CONSTRAINT "Voluntario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoluntarioRol" (
    "voluntarioId" TEXT NOT NULL,
    "rol" "RolSistema" NOT NULL,

    CONSTRAINT "VoluntarioRol_pkey" PRIMARY KEY ("voluntarioId","rol")
);

-- CreateTable
CREATE TABLE "Oficialidad" (
    "id" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "voluntarioId" TEXT NOT NULL,

    CONSTRAINT "Oficialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnoVoluntario" (
    "turnoId" TEXT NOT NULL,
    "voluntarioId" TEXT NOT NULL,

    CONSTRAINT "TurnoVoluntario_pkey" PRIMARY KEY ("turnoId","voluntarioId")
);

-- CreateTable
CREATE TABLE "Citacion" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Citacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CamaAsignacion" (
    "id" TEXT NOT NULL,
    "citacionId" TEXT NOT NULL,
    "numeroCama" INTEGER NOT NULL,
    "voluntarioId" TEXT NOT NULL,

    CONSTRAINT "CamaAsignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permiso" (
    "id" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "tipo" "TipoPermiso" NOT NULL,
    "reemplazanteId" TEXT,
    "fechaGuardia" DATE NOT NULL,
    "estado" "EstadoPermiso" NOT NULL DEFAULT 'PENDIENTE',
    "comentarios" TEXT,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),

    CONSTRAINT "Permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorreccionNoche" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "voluntarioId" TEXT NOT NULL,
    "durmio" BOOLEAN NOT NULL,
    "autorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorreccionNoche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensajero" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "voluntarioId" TEXT NOT NULL,

    CONSTRAINT "Mensajero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConductorGuardia" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "voluntarioId" TEXT NOT NULL,

    CONSTRAINT "ConductorGuardia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JGsSubrogante" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "voluntarioId" TEXT NOT NULL,

    CONSTRAINT "JGsSubrogante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Licencia" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "voluntarioId" TEXT NOT NULL,

    CONSTRAINT "Licencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuartelero" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nacimiento" DATE,
    "fechaIngreso" DATE,
    "vigente" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Cuartelero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pauta" (
    "id" TEXT NOT NULL,
    "cuarteleroId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,

    CONSTRAINT "Pauta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carro" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Carro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarroVoluntario" (
    "carroId" TEXT NOT NULL,
    "voluntarioId" TEXT NOT NULL,

    CONSTRAINT "CarroVoluntario_pkey" PRIMARY KEY ("carroId","voluntarioId")
);

-- CreateTable
CREATE TABLE "CarroCuartelero" (
    "carroId" TEXT NOT NULL,
    "cuarteleroId" TEXT NOT NULL,

    CONSTRAINT "CarroCuartelero_pkey" PRIMARY KEY ("carroId","cuarteleroId")
);

-- CreateTable
CREATE TABLE "CalendarioConductor" (
    "id" TEXT NOT NULL,
    "voluntarioId" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "CalendarioConductor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarioConductorCarro" (
    "calendarioId" TEXT NOT NULL,
    "carroId" TEXT NOT NULL,

    CONSTRAINT "CalendarioConductorCarro_pkey" PRIMARY KEY ("calendarioId","carroId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Voluntario_userId_key" ON "Voluntario"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Oficialidad_voluntarioId_key" ON "Oficialidad"("voluntarioId");

-- CreateIndex
CREATE UNIQUE INDEX "CamaAsignacion_citacionId_numeroCama_key" ON "CamaAsignacion"("citacionId", "numeroCama");

-- CreateIndex
CREATE UNIQUE INDEX "CorreccionNoche_fecha_voluntarioId_key" ON "CorreccionNoche"("fecha", "voluntarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Mensajero_fecha_key" ON "Mensajero"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "ConductorGuardia_fecha_voluntarioId_key" ON "ConductorGuardia"("fecha", "voluntarioId");

-- CreateIndex
CREATE UNIQUE INDEX "JGsSubrogante_fecha_key" ON "JGsSubrogante"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Licencia_fecha_voluntarioId_key" ON "Licencia"("fecha", "voluntarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Pauta_cuarteleroId_fecha_key" ON "Pauta"("cuarteleroId", "fecha");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voluntario" ADD CONSTRAINT "Voluntario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoluntarioRol" ADD CONSTRAINT "VoluntarioRol_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oficialidad" ADD CONSTRAINT "Oficialidad_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoVoluntario" ADD CONSTRAINT "TurnoVoluntario_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoVoluntario" ADD CONSTRAINT "TurnoVoluntario_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citacion" ADD CONSTRAINT "Citacion_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CamaAsignacion" ADD CONSTRAINT "CamaAsignacion_citacionId_fkey" FOREIGN KEY ("citacionId") REFERENCES "Citacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CamaAsignacion" ADD CONSTRAINT "CamaAsignacion_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permiso" ADD CONSTRAINT "Permiso_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permiso" ADD CONSTRAINT "Permiso_reemplazanteId_fkey" FOREIGN KEY ("reemplazanteId") REFERENCES "Voluntario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorreccionNoche" ADD CONSTRAINT "CorreccionNoche_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorreccionNoche" ADD CONSTRAINT "CorreccionNoche_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Voluntario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensajero" ADD CONSTRAINT "Mensajero_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductorGuardia" ADD CONSTRAINT "ConductorGuardia_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JGsSubrogante" ADD CONSTRAINT "JGsSubrogante_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licencia" ADD CONSTRAINT "Licencia_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pauta" ADD CONSTRAINT "Pauta_cuarteleroId_fkey" FOREIGN KEY ("cuarteleroId") REFERENCES "Cuartelero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarroVoluntario" ADD CONSTRAINT "CarroVoluntario_carroId_fkey" FOREIGN KEY ("carroId") REFERENCES "Carro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarroVoluntario" ADD CONSTRAINT "CarroVoluntario_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarroCuartelero" ADD CONSTRAINT "CarroCuartelero_carroId_fkey" FOREIGN KEY ("carroId") REFERENCES "Carro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarroCuartelero" ADD CONSTRAINT "CarroCuartelero_cuarteleroId_fkey" FOREIGN KEY ("cuarteleroId") REFERENCES "Cuartelero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarioConductor" ADD CONSTRAINT "CalendarioConductor_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarioConductorCarro" ADD CONSTRAINT "CalendarioConductorCarro_calendarioId_fkey" FOREIGN KEY ("calendarioId") REFERENCES "CalendarioConductor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarioConductorCarro" ADD CONSTRAINT "CalendarioConductorCarro_carroId_fkey" FOREIGN KEY ("carroId") REFERENCES "Carro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
