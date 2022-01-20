import { Module } from '@nestjs/common';
import { FarmModule, TokenModule } from '@seongeun/aggregator-base/lib/module';
import { QuickSwapSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/quick-swap/quick-swap.scheduler.module';
import { HandlerModule } from '../app/handler/handler.module';
import { QuickSwapPolygonDexTask } from './polygon/quick-swap.polygon.dex.task';
import { QuickSwapPolygonFarmTask } from './polygon/quick-swap.polygon.farm.task';
import { QuickSwapPolygonFarm_2_Task } from './polygon/quick-swap.polygon.farm-2.task';

@Module({
  imports: [QuickSwapSchedulerModule, FarmModule, TokenModule, HandlerModule],
  providers: [
    QuickSwapPolygonDexTask,
    QuickSwapPolygonFarmTask,
    QuickSwapPolygonFarm_2_Task,
  ],
  exports: [
    QuickSwapPolygonDexTask,
    QuickSwapPolygonFarmTask,
    QuickSwapPolygonFarm_2_Task,
  ],
})
export class QuickSwapTaskModule {}
