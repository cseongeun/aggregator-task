import { Module } from '@nestjs/common';
import {
  TokenModule,
  LendingModule,
} from '@seongeun/aggregator-base/lib/module';
import { AaveSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/aave/aave.scheduler.module';
import { AaveAvalancheLendingTask } from './avalanche/aave.avalanche.lending.task';
import { AavePolygonLendingTask } from './polygon/aave.polygon.lending.task';
import { HandlerModule } from '../app/handler/handler.module';
import { AaveAvalancheLendingEventTask } from './avalanche/aave.avalanche.lending.event.task';

@Module({
  imports: [AaveSchedulerModule, TokenModule, LendingModule, HandlerModule],
  providers: [
    AavePolygonLendingTask,
    AaveAvalancheLendingTask,
    AaveAvalancheLendingEventTask,
  ],
  exports: [
    AavePolygonLendingTask,
    AaveAvalancheLendingTask,
    AaveAvalancheLendingEventTask,
  ],
})
export class AaveTaskModule {}
