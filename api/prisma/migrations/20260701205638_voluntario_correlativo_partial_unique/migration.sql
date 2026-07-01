-- Prisma no soporta índices únicos parciales de forma nativa, por lo que se agregan como SQL raw.
-- QUINCE: correlativo único para siempre (1-999), independiente del estado activo/inactivo.
CREATE UNIQUE INDEX "vol_correlativo_quince" ON "Voluntario"("correlativo") WHERE "tipo" = 'QUINCE';

-- CONFEDERADO: correlativo único solo entre los activos (>=1000), se libera al desactivar.
CREATE UNIQUE INDEX "vol_correlativo_confederado_activo" ON "Voluntario"("correlativo") WHERE "tipo" = 'CONFEDERADO' AND "activo" = true;
