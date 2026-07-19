-- CreateEnum
CREATE TYPE "NivelAcceso" AS ENUM ('LEER', 'GESTIONAR');

-- CreateEnum
CREATE TYPE "TipoRecursoAcceso" AS ENUM ('CATEGORIA_INVENTARIO', 'UBICACION', 'CHECKLIST_TEMPLATE');

-- CreateEnum
CREATE TYPE "TipoSujetoAcceso" AS ENUM ('USUARIO', 'GRUPO');

-- CreateEnum
CREATE TYPE "EstadoItemInventario" AS ENUM ('OPERATIVO', 'EN_MANTENCION', 'FUERA_DE_SERVICIO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "TipoFrecuenciaChecklist" AS ENUM ('ROLLING', 'POR_CAMBIO_TURNO', 'ANTES_DE_USO');

-- CreateEnum
CREATE TYPE "TipoAlcanceChecklist" AS ENUM ('ITEM_INVENTARIO', 'CATEGORIA_INVENTARIO', 'UBICACION');

-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoMiembro" (
    "grupoId" TEXT NOT NULL,
    "voluntarioId" TEXT NOT NULL,

    CONSTRAINT "GrupoMiembro_pkey" PRIMARY KEY ("grupoId","voluntarioId")
);

-- CreateTable
CREATE TABLE "Autorizacion" (
    "id" TEXT NOT NULL,
    "sujetoTipo" "TipoSujetoAcceso" NOT NULL,
    "voluntarioId" TEXT,
    "grupoId" TEXT,
    "recursoTipo" "TipoRecursoAcceso" NOT NULL,
    "recursoId" TEXT NOT NULL,
    "nivel" "NivelAcceso" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Autorizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaInventario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategoriaInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ubicacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "carroId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Ubicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemInventario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoriaId" TEXT NOT NULL,
    "ubicacionId" TEXT NOT NULL,
    "codigo" TEXT,
    "estado" "EstadoItemInventario" NOT NULL DEFAULT 'OPERATIVO',
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "alcanceTipo" "TipoAlcanceChecklist" NOT NULL,
    "alcanceId" TEXT NOT NULL,
    "tipoFrecuencia" "TipoFrecuenciaChecklist" NOT NULL,
    "intervaloMinutos" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "checklistTemplateId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistEjecucion" (
    "id" TEXT NOT NULL,
    "checklistTemplateId" TEXT NOT NULL,
    "ejecutadoPorId" TEXT NOT NULL,
    "fechaEjecucion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacionesGenerales" TEXT,

    CONSTRAINT "ChecklistEjecucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistEjecucionItem" (
    "id" TEXT NOT NULL,
    "checklistEjecucionId" TEXT NOT NULL,
    "checklistTemplateItemId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cumple" BOOLEAN NOT NULL,
    "observacion" TEXT,

    CONSTRAINT "ChecklistEjecucionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GrupoMiembro_voluntarioId_idx" ON "GrupoMiembro"("voluntarioId");

-- CreateIndex
CREATE INDEX "Autorizacion_sujetoTipo_voluntarioId_idx" ON "Autorizacion"("sujetoTipo", "voluntarioId");

-- CreateIndex
CREATE INDEX "Autorizacion_sujetoTipo_grupoId_idx" ON "Autorizacion"("sujetoTipo", "grupoId");

-- CreateIndex
CREATE INDEX "Autorizacion_recursoTipo_recursoId_idx" ON "Autorizacion"("recursoTipo", "recursoId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_alcanceTipo_alcanceId_idx" ON "ChecklistTemplate"("alcanceTipo", "alcanceId");

-- CreateIndex
CREATE INDEX "ChecklistEjecucion_checklistTemplateId_fechaEjecucion_idx" ON "ChecklistEjecucion"("checklistTemplateId", "fechaEjecucion");

-- AddForeignKey
ALTER TABLE "GrupoMiembro" ADD CONSTRAINT "GrupoMiembro_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoMiembro" ADD CONSTRAINT "GrupoMiembro_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autorizacion" ADD CONSTRAINT "Autorizacion_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "Voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autorizacion" ADD CONSTRAINT "Autorizacion_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ubicacion" ADD CONSTRAINT "Ubicacion_carroId_fkey" FOREIGN KEY ("carroId") REFERENCES "Carro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemInventario" ADD CONSTRAINT "ItemInventario_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaInventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemInventario" ADD CONSTRAINT "ItemInventario_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistEjecucion" ADD CONSTRAINT "ChecklistEjecucion_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistEjecucion" ADD CONSTRAINT "ChecklistEjecucion_ejecutadoPorId_fkey" FOREIGN KEY ("ejecutadoPorId") REFERENCES "Voluntario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistEjecucionItem" ADD CONSTRAINT "ChecklistEjecucionItem_checklistEjecucionId_fkey" FOREIGN KEY ("checklistEjecucionId") REFERENCES "ChecklistEjecucion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
