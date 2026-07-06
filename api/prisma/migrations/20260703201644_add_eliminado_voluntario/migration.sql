-- AlterTable
ALTER TABLE "Voluntario" ADD COLUMN     "eliminado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "eliminadoEn" TIMESTAMP(3);
