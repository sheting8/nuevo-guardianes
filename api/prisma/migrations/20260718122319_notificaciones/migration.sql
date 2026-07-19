-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('CHECKLIST_VENCIDO', 'PERMISO_SOLICITADO', 'PERMISO_APROBADO', 'PERMISO_RECHAZADO');

-- CreateEnum
CREATE TYPE "PlataformaDispositivo" AS ENUM ('WEB', 'ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "voluntarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "datos" JSONB,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispositivoNotificacion" (
    "id" TEXT NOT NULL,
    "voluntarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" "PlataformaDispositivo" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispositivoNotificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notificacion_voluntarioId_leida_idx" ON "Notificacion"("voluntarioId", "leida");

-- CreateIndex
CREATE INDEX "Notificacion_voluntarioId_createdAt_idx" ON "Notificacion"("voluntarioId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DispositivoNotificacion_token_key" ON "DispositivoNotificacion"("token");

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispositivoNotificacion" ADD CONSTRAINT "DispositivoNotificacion_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
