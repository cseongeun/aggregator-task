import { Module } from '@nestjs/common';
import {
  FarmModule,
  NFTokenModule,
  TokenModule,
} from '@seongeun/aggregator-base/lib/module';
import { ApeSwapSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/ape-swap/ape-swap.scheduler.module';
import { HandlerModule } from '../app/handler/handler.module';
import { ApeSwapBinanceSmartChainDexTask } from './binance-smart-chain/ape-swap.binance-smart-chain.dex.task';
import { ApeSwapBinanceSmartChainFarmTask } from './binance-smart-chain/ape-swap.binance-smart-chain.farm.task';
import { ApeSwapBinanceSmartChainNFTTask } from './binance-smart-chain/ape-swap.binance-smart-chain.nft.task';
import { ApeSwapPolygonDexTask } from './polygon/ape-swap.polygon.dex.task';
import { ApeSwapPolygonFarmTask } from './polygon/ape-swap.polygon.farm.task';

@Module({
  imports: [
    ApeSwapSchedulerModule,
    TokenModule,
    FarmModule,
    NFTokenModule,
    HandlerModule,
  ],
  providers: [
    ApeSwapBinanceSmartChainDexTask,
    ApeSwapBinanceSmartChainFarmTask,
    ApeSwapBinanceSmartChainNFTTask,

    ApeSwapPolygonDexTask,
    ApeSwapPolygonFarmTask,
  ],
  exports: [
    ApeSwapBinanceSmartChainDexTask,
    ApeSwapBinanceSmartChainFarmTask,
    ApeSwapBinanceSmartChainNFTTask,

    ApeSwapPolygonDexTask,
    ApeSwapPolygonFarmTask,
  ],
})
export class ApeSwapTaskModule {}
