import { Module } from '@nestjs/common';
import {
  NetworkModule,
  TokenModule,
} from '@seongeun/aggregator-base/lib/module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { TokenSupplyAvalancheAllTask } from './avalanche/token-supply.avalanche.all.task';
import { TokenSupplyBinanceSmartChainAllTask } from './binance-smart-chain/token-supply.binance-smart-chain.all.task';
import { TokenSupplyFantomAllTask } from './fantom/token-supply.fantom.all.task';
import { TokenSupplyHecoAllTask } from './heco/token-supply.heco.all.task';
import { TokenSupplyKlaytnAllTask } from './klaytn/token-supply.klaytn.all.task';
import { TokenSupplyPolygonAllTask } from './polygon/token-supply.polygon.all.task';
import { TokenSupplyXdaiAllTask } from './xdai/token-supply.xdai.all.task';

@Module({
  imports: [NetworkModule, TokenModule, TaskHandlerModule],
  providers: [
    TokenSupplyAvalancheAllTask,
    TokenSupplyBinanceSmartChainAllTask,
    TokenSupplyFantomAllTask,
    TokenSupplyHecoAllTask,
    TokenSupplyKlaytnAllTask,
    TokenSupplyPolygonAllTask,
    TokenSupplyXdaiAllTask,
  ],
  exports: [
    TokenSupplyAvalancheAllTask,
    TokenSupplyBinanceSmartChainAllTask,
    TokenSupplyFantomAllTask,
    TokenSupplyHecoAllTask,
    TokenSupplyKlaytnAllTask,
    TokenSupplyPolygonAllTask,
    TokenSupplyXdaiAllTask,
  ],
})
export class TokenSupplyTaskModule {}
