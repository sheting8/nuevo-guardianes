import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateVoluntarioDto } from './create-voluntario.dto';

export class UpdateVoluntarioDto extends PartialType(
  OmitType(CreateVoluntarioDto, ['tipo', 'correlativo'] as const),
) {}
