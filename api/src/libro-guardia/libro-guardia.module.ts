import { Module } from '@nestjs/common';
import { LibroGuardiaController } from './libro-guardia.controller';
import { LibroGuardiaService } from './libro-guardia.service';

@Module({
  controllers: [LibroGuardiaController],
  providers: [LibroGuardiaService],
  exports: [LibroGuardiaService],
})
export class LibroGuardiaModule {}
