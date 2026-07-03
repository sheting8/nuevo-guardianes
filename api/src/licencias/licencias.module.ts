import { Module } from '@nestjs/common';
import { LicenciasController } from './licencias.controller';
import { LicenciasService } from './licencias.service';

@Module({
  controllers: [LicenciasController],
  providers: [LicenciasService],
  exports: [LicenciasService],
})
export class LicenciasModule {}
