import { Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService, FcmService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
