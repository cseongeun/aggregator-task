import { Module } from '@nestjs/common';
import {
  NetworkModule,
  TokenModule,
  TokenPriceModule,
} from '@seongeun/aggregator-base/lib/module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { TokenPriceBinanceSmartChainChainLinkOracleTask } from './binance-smart-chain/token-price.binance-smart-chain.chain-link-oracle';
import { TokenPriceBinanceSmartChainMultiDexTask } from './binance-smart-chain/token-price.binance-smart-chain.multi-dex.task';
import { TokenPriceBinanceSmartChainSingleDexTask } from './binance-smart-chain/token-price.binance-smart-chain.single-dex.task';

@Module({
  imports: [NetworkModule, TokenModule, TaskHandlerModule, TokenPriceModule],
  providers: [
    TokenPriceBinanceSmartChainChainLinkOracleTask,
    TokenPriceBinanceSmartChainMultiDexTask,
    TokenPriceBinanceSmartChainSingleDexTask,
  ],
  exports: [
    TokenPriceBinanceSmartChainChainLinkOracleTask,
    TokenPriceBinanceSmartChainMultiDexTask,
    TokenPriceBinanceSmartChainSingleDexTask,
  ],
})
export class TokenPriceTaskModule {}
