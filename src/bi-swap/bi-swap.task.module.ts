import { Module } from '@nestjs/common';
import { FarmModule, TokenModule } from '@seongeun/aggregator-base/lib/module';
import { BiSwapSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/bi-swap/bi-swap.scheduler.module';
import { HandlerModule } from '../app/handler/handler.module';
import { BiSwapBinanceSmartChainDexTask } from './binance-smart-chain/bi-swap.binance-smart-chain.dex.task';
import { BiSwapBinanceSmartChainFarmTask } from './binance-smart-chain/bi-swap.binance-smart-chain.farm.task';

@Module({
  imports: [BiSwapSchedulerModule, TokenModule, FarmModule, HandlerModule],
  providers: [BiSwapBinanceSmartChainDexTask, BiSwapBinanceSmartChainFarmTask],
  exports: [BiSwapBinanceSmartChainDexTask, BiSwapBinanceSmartChainFarmTask],
})
export class BiSwapTaskModule {}
