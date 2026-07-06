import { Module } from '@nestjs/common';
import { NochesModule } from '../noches/noches.module';
import { ImportarVoluntariosService } from './importar-voluntarios.service';
import { VoluntariosController } from './voluntarios.controller';
import { VoluntariosService } from './voluntarios.service';

@Module({
  imports: [NochesModule],
  controllers: [VoluntariosController],
  providers: [VoluntariosService, ImportarVoluntariosService],
  exports: [VoluntariosService],
})
export class VoluntariosModule {}
