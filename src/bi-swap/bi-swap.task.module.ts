import { Module } from '@nestjs/common';
import { FarmModule, TokenModule } from '@seongeun/aggregator-base/lib/module';
import { BiSwapSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/bi-swap/bi-swap.scheduler.module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { BiSwapBinanceSmartChainDexTask } from './binance-smart-chain/bi-swap.binance-smart-chain.dex.task';
import { BiSwapBinanceSmartChainFarmTask } from './binance-smart-chain/bi-swap.binance-smart-chain.farm.task';

@Module({
  imports: [BiSwapSchedulerModule, TokenModule, FarmModule, TaskHandlerModule],
  providers: [BiSwapBinanceSmartChainDexTask, BiSwapBinanceSmartChainFarmTask],
  exports: [BiSwapBinanceSmartChainDexTask, BiSwapBinanceSmartChainFarmTask],
})
export class BiSwapTaskModule {}
