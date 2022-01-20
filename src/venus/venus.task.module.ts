import { Module } from '@nestjs/common';
import {
  LendingModule,
  TokenModule,
} from '@seongeun/aggregator-base/lib/module';
import { VenusSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/venus/venus.scheduler.module';
import { HandlerModule } from '../app/handler/handler.module';
import { VenusBinanceSmartChainLendingTask } from './binance-smart-chain/venus.binance-smart-chain.lending.task';

@Module({
  imports: [VenusSchedulerModule, LendingModule, TokenModule, HandlerModule],
  providers: [VenusBinanceSmartChainLendingTask],
  exports: [VenusBinanceSmartChainLendingTask],
})
export class VenusTaskModule {}
