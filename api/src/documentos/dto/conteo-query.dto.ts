import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ConteoQueryDto {
  @ApiProperty()
  @IsString({ message: 'La citación es requerida' })
  citacionId: string;
}
