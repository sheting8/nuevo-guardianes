import { Module } from '@nestjs/common';
import { NochesModule } from '../noches/noches.module';
import { VoluntariosController } from './voluntarios.controller';
import { VoluntariosService } from './voluntarios.service';

@Module({
  imports: [NochesModule],
  controllers: [VoluntariosController],
  providers: [VoluntariosService],
  exports: [VoluntariosService],
})
export class VoluntariosModule {}
