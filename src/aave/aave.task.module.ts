import { Module } from '@nestjs/common';
import {
  TaskModule,
  TokenModule,
  LendingModule,
} from '@seongeun/aggregator-base/lib/module';
import { AaveSchedulerModule } from '@seongeun/aggregator-defi-protocol';
// import { TaskLoggerModule } from '../app/logger/task-logger.module';
import { TaskManagerModule } from '../app/manager/task-manager.module';
import { AaveAvalancheLendingTask } from './avalanche/aave.avalanche.lending.task';
import { AavePolygonLendingTask } from './polygon/aave.polygon.lending.task';

@Module({
  imports: [
    AaveSchedulerModule,
    TaskModule,
    TokenModule,
    LendingModule,
    TaskManagerModule,
    // TaskLoggerModule,
  ],
  providers: [AavePolygonLendingTask, AaveAvalancheLendingTask],
  exports: [AavePolygonLendingTask, AaveAvalancheLendingTask],
})
export class AaveTaskModule {}
