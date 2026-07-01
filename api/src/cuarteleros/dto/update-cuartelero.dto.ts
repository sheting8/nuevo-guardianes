import { PartialType } from '@nestjs/swagger';
import { CreateCuarteleroDto } from './create-cuartelero.dto';

export class UpdateCuarteleroDto extends PartialType(CreateCuarteleroDto) {}
