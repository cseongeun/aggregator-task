import { Module } from '@nestjs/common';
import { FarmModule, TokenModule } from '@seongeun/aggregator-base/lib/module';
import { ApeSwapSchedulerModule } from '@seongeun/aggregator-defi-protocol';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { ApeSwapBinanceSmartChainDexTask } from './binance-smart-chain/ape-swap.binance-smart-chain.dex.task';
import { ApeSwapBinanceSmartChainFarmTask } from './binance-smart-chain/ape-swap.binance-smart-chain.farm.task';

@Module({
  imports: [ApeSwapSchedulerModule, TokenModule, FarmModule, TaskHandlerModule],
  providers: [
    ApeSwapBinanceSmartChainDexTask,
    ApeSwapBinanceSmartChainFarmTask,
  ],
  exports: [ApeSwapBinanceSmartChainDexTask, ApeSwapBinanceSmartChainFarmTask],
})
export class ApeSwapTaskModule {}
