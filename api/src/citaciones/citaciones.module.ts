import { Module } from '@nestjs/common';
import { CitacionesController } from './citaciones.controller';
import { CitacionesService } from './citaciones.service';

@Module({
  controllers: [CitacionesController],
  providers: [CitacionesService],
  exports: [CitacionesService],
})
export class CitacionesModule {}
