import { Module } from '@nestjs/common';
import { OficialidadController } from './oficialidad.controller';
import { OficialidadService } from './oficialidad.service';

@Module({
  controllers: [OficialidadController],
  providers: [OficialidadService],
})
export class OficialidadModule {}
