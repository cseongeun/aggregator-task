import { Module } from '@nestjs/common';
import {
  TokenModule,
  LendingModule,
} from '@seongeun/aggregator-base/lib/module';
import { AaveSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/aave/aave.scheduler.module';
import { AaveAvalancheLendingTask } from './avalanche/aave.avalanche.lending.task';
import { AavePolygonLendingTask } from './polygon/aave.polygon.lending.task';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';

@Module({
  imports: [AaveSchedulerModule, TokenModule, LendingModule, TaskHandlerModule],
  providers: [AavePolygonLendingTask, AaveAvalancheLendingTask],
  exports: [AavePolygonLendingTask, AaveAvalancheLendingTask],
})
export class AaveTaskModule {}
