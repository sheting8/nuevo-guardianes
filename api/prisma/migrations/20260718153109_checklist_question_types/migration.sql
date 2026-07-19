-- CreateEnum
CREATE TYPE "TipoPreguntaChecklist" AS ENUM ('PASA_FALLA', 'NUMERO', 'SELECTOR', 'MATRIZ', 'TEXTO');

-- AlterTable: ChecklistTemplateItem — nueva columna con default, filas
-- existentes quedan válidas como PASA_FALLA implícito, sin backfill necesario.
ALTER TABLE "ChecklistTemplateItem"
  ADD COLUMN "configuracion" JSONB,
  ADD COLUMN "tipoPregunta" "TipoPreguntaChecklist" NOT NULL DEFAULT 'PASA_FALLA';

-- AlterTable: ChecklistEjecucionItem — respuesta/tipoPregunta reemplazan a
-- cumple. Se agregan NULLABLE primero porque la tabla puede tener filas
-- existentes (cumple no tiene default con el que Prisma pueda generar un
-- backfill automático), se rellenan a partir de cumple, y recién ahí se
-- endurecen a NOT NULL y se elimina la columna vieja.
ALTER TABLE "ChecklistEjecucionItem"
  ADD COLUMN "respuesta" JSONB,
  ADD COLUMN "tipoPregunta" "TipoPreguntaChecklist";

UPDATE "ChecklistEjecucionItem"
SET "respuesta" = to_jsonb("cumple"),
    "tipoPregunta" = 'PASA_FALLA';

ALTER TABLE "ChecklistEjecucionItem"
  ALTER COLUMN "respuesta" SET NOT NULL,
  ALTER COLUMN "tipoPregunta" SET NOT NULL,
  DROP COLUMN "cumple";
