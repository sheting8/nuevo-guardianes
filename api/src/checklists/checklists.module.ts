import { Module } from '@nestjs/common';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { RbacModule } from '../rbac/rbac.module';
import { ChecklistsVencidosScheduler } from './checklists-vencidos.scheduler';
import { ChecklistsController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';

@Module({
  imports: [RbacModule, NotificacionesModule],
  controllers: [ChecklistsController],
  providers: [ChecklistsService, ChecklistsVencidosScheduler],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
