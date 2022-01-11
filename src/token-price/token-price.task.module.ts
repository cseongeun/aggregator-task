import { Module } from '@nestjs/common';
import {
  NetworkModule,
  TokenModule,
} from '@seongeun/aggregator-base/lib/module';
import { VenusSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/venus/venus.scheduler.module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { TokenPriceBinance } from './binance-smart-chain/token-price.binance-smart-chain.chain-link-oracle';

@Module({
  imports: [NetworkModule, TokenModule, TaskHandlerModule],
  providers: [TokenPriceBinance],
  exports: [TokenPriceBinance],
})
export class TokenPriceTaskModule {}
