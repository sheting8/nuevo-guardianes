import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ChecklistsService } from './checklists.service';

@Injectable()
export class ChecklistsVencidosScheduler {
  private readonly logger = new Logger(ChecklistsVencidosScheduler.name);

  constructor(private readonly checklistsService: ChecklistsService) {}

  @Cron('0 */15 * * * *')
  async revisarVencidos(): Promise<void> {
    try {
      await this.checklistsService.notificarVencidos();
    } catch (error) {
      this.logger.warn(
        `Error revisando checklists vencidos: ${(error as Error).message}`,
      );
    }
  }
}
