import { Module } from '@nestjs/common';
import {
  NetworkModule,
  TokenModule,
  TokenPriceModule,
} from '@seongeun/aggregator-base/lib/module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { TokenPriceChainLinkService } from '../task-app/template/token-price/service/token-price.chain-link-oracle.service';
import { TokenPriceMultiDexService } from '../task-app/template/token-price/service/token-price.multi-dex.service';
import { TokenPriceSingleDexService } from '../task-app/template/token-price/service/token-price.single-dex.service';
import { TokenPriceBinanceSmartChainAllTask } from './binance-smart-chain/token-price.binance-smart-chain.all.task';

@Module({
  imports: [NetworkModule, TokenModule, TaskHandlerModule, TokenPriceModule],
  providers: [
    TokenPriceBinanceSmartChainAllTask,
    TokenPriceChainLinkService,
    TokenPriceMultiDexService,
    TokenPriceSingleDexService,
  ],
  exports: [TokenPriceBinanceSmartChainAllTask],
})
export class TokenPriceTaskModule {}
