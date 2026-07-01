import { Module } from '@nestjs/common';
import { CarrosController } from './carros.controller';
import { CarrosService } from './carros.service';

@Module({
  controllers: [CarrosController],
  providers: [CarrosService],
})
export class CarrosModule {}
