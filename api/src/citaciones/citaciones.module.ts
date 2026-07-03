import { Module } from '@nestjs/common';
import { NochesModule } from '../noches/noches.module';
import { CitacionesController } from './citaciones.controller';
import { CitacionesService } from './citaciones.service';

@Module({
  imports: [NochesModule],
  controllers: [CitacionesController],
  providers: [CitacionesService],
  exports: [CitacionesService],
})
export class CitacionesModule {}
