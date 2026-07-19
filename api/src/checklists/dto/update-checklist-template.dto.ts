import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateChecklistTemplateDto } from './create-checklist-template.dto';

// La edición de items (agregar/quitar/reordenar preguntas) no se cubre acá —
// este endpoint sólo actualiza los metadatos de la plantilla.
export class UpdateChecklistTemplateDto extends PartialType(
  OmitType(CreateChecklistTemplateDto, ['items'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
