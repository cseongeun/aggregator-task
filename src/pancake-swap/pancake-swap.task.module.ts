import { Module } from '@nestjs/common';
import {
  FarmModule,
  NFTokenModule,
  TokenModule,
} from '@seongeun/aggregator-base/lib/module';
import { PancakeSwapSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/pancake-swap/pancake-swap.scheduler.module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { PancakeSwapBinanceSmartChainDexTask } from './binance-smart-chain/pancake-swap.binance-smart-chain.dex.task';
import { PancakeSwapBinanceSmartChainFarm_2_Task } from './binance-smart-chain/pancake-swap.binance-smart-chain.farm-2.task';
import { PancakeSwapBinanceSmartChainFarmTask } from './binance-smart-chain/pancake-swap.binance-smart-chain.farm.task';
import { PancakeSwapBinanceSmartChainNFT_2_Task } from './binance-smart-chain/pancake-swap.binance-smart-chain.nft-2.task';
import { PancakeSwapBinanceSmartChainNFT_3_Task } from './binance-smart-chain/pancake-swap.binance-smart-chain.nft-3.task';
import { PancakeSwapBinanceSmartChainNFT_4_Task } from './binance-smart-chain/pancake-swap.binance-smart-chain.nft-4.task';
import { PancakeSwapBinanceSmartChainNFT_5_Task } from './binance-smart-chain/pancake-swap.binance-smart-chain.nft-5.task';
import { PancakeSwapBinanceSmartChainNFTTask } from './binance-smart-chain/pancake-swap.binance-smart-chain.nft.task';

@Module({
  imports: [
    PancakeSwapSchedulerModule,
    FarmModule,
    TokenModule,
    NFTokenModule,
    TaskHandlerModule,
  ],
  providers: [
    PancakeSwapBinanceSmartChainDexTask,
    PancakeSwapBinanceSmartChainFarmTask,
    PancakeSwapBinanceSmartChainFarm_2_Task,
    PancakeSwapBinanceSmartChainNFTTask,
    PancakeSwapBinanceSmartChainNFT_2_Task,
    PancakeSwapBinanceSmartChainNFT_3_Task,
    PancakeSwapBinanceSmartChainNFT_4_Task,
    PancakeSwapBinanceSmartChainNFT_5_Task,
  ],
  exports: [
    PancakeSwapBinanceSmartChainDexTask,
    PancakeSwapBinanceSmartChainFarmTask,
    PancakeSwapBinanceSmartChainFarm_2_Task,
    PancakeSwapBinanceSmartChainNFTTask,
    PancakeSwapBinanceSmartChainNFT_2_Task,
    PancakeSwapBinanceSmartChainNFT_3_Task,
    PancakeSwapBinanceSmartChainNFT_4_Task,
    PancakeSwapBinanceSmartChainNFT_5_Task,
  ],
})
export class PancakeSwapTaskModule {}
