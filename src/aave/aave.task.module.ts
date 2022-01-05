import { Module } from '@nestjs/common';
import {
  TokenModule,
  LendingModule,
} from '@seongeun/aggregator-base/lib/module';
import { AaveSchedulerModule } from '@seongeun/aggregator-defi-protocol';
import { AaveAvalancheLendingTask } from './avalanche/aave.avalanche.lending.task';
import { AavePolygonLendingTask } from './polygon/aave.polygon.lending.task';
import { TaskHandlerModule } from '../app/handler/task-handler.module';

@Module({
  imports: [AaveSchedulerModule, TokenModule, LendingModule, TaskHandlerModule],
  // providers: [AavePolygonLendingTask, AaveAvalancheLendingTask],
  // exports: [AavePolygonLendingTask, AaveAvalancheLendingTask],
  providers: [AaveAvalancheLendingTask],
  exports: [AaveAvalancheLendingTask],
})
export class AaveTaskModule {}
