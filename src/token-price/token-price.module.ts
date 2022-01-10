import { Module } from '@nestjs/common';
import {
  NetworkModule,
  TokenModule,
} from '@seongeun/aggregator-base/lib/module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { TokenPriceAvalancheChainLink } from './avalanche/token-price.avalanche.chainlink.task';
import { TokenPriceBinanceSmartChainChainLink } from './binance-smart-chain/token-price.binance-smart-chain.chainlink.task';

@Module({
  imports: [NetworkModule, TokenModule, TaskHandlerModule],
  providers: [
    TokenPriceAvalancheChainLink,
    TokenPriceBinanceSmartChainChainLink,
  ],
  exports: [TokenPriceAvalancheChainLink, TokenPriceBinanceSmartChainChainLink],
})
export class TokenPriceTaskModule {}
