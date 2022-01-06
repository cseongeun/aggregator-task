import { Module } from '@nestjs/common';
import { FarmModule, TokenModule } from '@seongeun/aggregator-base/lib/module';
import { BakerySwapSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/bakery-swap/bakery-swap.scheduler.module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { BakerySwapBinanceSmartChainDexTask } from './binance-smart-chain/bakery-swap.binance-smart-chain.dex.task';
import { BakerySwapBinanceSmartChainFarmTask } from './binance-smart-chain/bakery-swap.binance-smart-chain.farm.task';

@Module({
  imports: [
    BakerySwapSchedulerModule,
    TokenModule,
    FarmModule,
    TaskHandlerModule,
  ],
  providers: [
    BakerySwapBinanceSmartChainDexTask,
    BakerySwapBinanceSmartChainFarmTask,
  ],
  exports: [
    BakerySwapBinanceSmartChainDexTask,
    BakerySwapBinanceSmartChainFarmTask,
  ],
})
export class BakerySwapTaskModule {}
