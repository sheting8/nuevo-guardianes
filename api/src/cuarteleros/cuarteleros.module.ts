import { Module } from '@nestjs/common';
import { CuartelerosController } from './cuarteleros.controller';
import { CuartelerosService } from './cuarteleros.service';

@Module({
  controllers: [CuartelerosController],
  providers: [CuartelerosService],
  exports: [CuartelerosService],
})
export class CuartelerosModule {}
