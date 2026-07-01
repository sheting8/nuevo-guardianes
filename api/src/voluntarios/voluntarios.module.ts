import { Module } from '@nestjs/common';
import { VoluntariosController } from './voluntarios.controller';
import { VoluntariosService } from './voluntarios.service';

@Module({
  controllers: [VoluntariosController],
  providers: [VoluntariosService],
  exports: [VoluntariosService],
})
export class VoluntariosModule {}
