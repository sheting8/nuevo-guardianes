import { Module } from '@nestjs/common';
import { CitacionesModule } from '../citaciones/citaciones.module';
import { GuardiaModule } from '../guardia/guardia.module';
import { NochesModule } from '../noches/noches.module';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';

@Module({
  imports: [CitacionesModule, GuardiaModule, NochesModule],
  controllers: [DocumentosController],
  providers: [DocumentosService],
})
export class DocumentosModule {}
