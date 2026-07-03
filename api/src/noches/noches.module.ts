import { Module } from '@nestjs/common';
import { NochesService } from './noches.service';

@Module({
  providers: [NochesService],
  exports: [NochesService],
})
export class NochesModule {}
