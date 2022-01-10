import { Module } from '@nestjs/common';
import {
  LendingModule,
  TokenModule,
} from '@seongeun/aggregator-base/lib/module';
import { VenusSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/venus/venus.scheduler.module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { VenusBinanceSmartChainLendingTask } from './binance-smart-chain/venus.binance-smart-chain.lending.task';

@Module({
  imports: [
    VenusSchedulerModule,
    LendingModule,
    TokenModule,
    TaskHandlerModule,
  ],
  providers: [VenusBinanceSmartChainLendingTask],
  exports: [VenusBinanceSmartChainLendingTask],
})
export class VenusTaskModule {}
