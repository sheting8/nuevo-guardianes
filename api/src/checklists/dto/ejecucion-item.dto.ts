import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsOptional, IsString, MinLength } from 'class-validator';

export class EjecucionItemDto {
  @ApiProperty({ description: 'id del ChecklistTemplateItem respondido' })
  @IsString({ message: 'El item del checklist es requerido' })
  @MinLength(1, { message: 'El item del checklist es requerido' })
  checklistTemplateItemId: string;

  @ApiProperty({
    description:
      'Forma según el tipoPregunta VIGENTE del item: boolean (PASA_FALLA), number (NUMERO), ' +
      'string o string[] (SELECTOR), { fila, columna }[] (MATRIZ), string (TEXTO). ' +
      'Validado en el service contra la pregunta vigente, no acá.',
  })
  @IsDefined({ message: 'La respuesta es requerida' })
  respuesta: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacion?: string;
}
