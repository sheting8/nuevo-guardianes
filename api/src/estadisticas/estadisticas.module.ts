import { Module } from '@nestjs/common';
import { NochesModule } from '../noches/noches.module';
import { EstadisticasController } from './estadisticas.controller';

@Module({
  imports: [NochesModule],
  controllers: [EstadisticasController],
})
export class EstadisticasModule {}
