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

import { TokenPriceAvalancheAllTask } from './avalanche/token-price.avalanche.all.task';
import { TokenPriceBinanceSmartChainAllTask } from './binance-smart-chain/token-price.binance-smart-chain.all.task';
import { TokenPriceFantomAllTask } from './fantom/token-price.fantom.all.task';
import { TokenPriceHecoAllTask } from './heco/token-price.heco.all.task';
import { TokenPriceKlaytnAllTask } from './klaytn/token-price.klaytn.all.task';
import { TokenPricePolygonAllTask } from './polygon/token-price.polygon.all.task';
import { TokenPriceXdaiAllTask } from './xdai/token-price.xdai.all.task';

@Module({
  imports: [NetworkModule, TokenModule, TaskHandlerModule, TokenPriceModule],
  providers: [
    TokenPriceChainLinkService,
    TokenPriceMultiDexService,
    TokenPriceSingleDexService,

    TokenPriceBinanceSmartChainAllTask,
    TokenPriceAvalancheAllTask,
    TokenPriceHecoAllTask,
    TokenPriceFantomAllTask,
    TokenPriceKlaytnAllTask,
    TokenPricePolygonAllTask,
    TokenPriceXdaiAllTask,
  ],
  exports: [
    TokenPriceBinanceSmartChainAllTask,
    TokenPriceAvalancheAllTask,
    TokenPriceHecoAllTask,
    TokenPriceFantomAllTask,
    TokenPriceKlaytnAllTask,
    TokenPricePolygonAllTask,
    TokenPriceXdaiAllTask,
  ],
})
export class TokenPriceTaskModule {}
