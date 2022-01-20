import { Module } from '@nestjs/common';
import { FarmModule, TokenModule } from '@seongeun/aggregator-base/lib/module';
import { WaultSwapSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/wault-swap/wault-swap.scheduler.module';
import { HandlerModule } from '../app/handler/handler.module';
import { WaultSwapBinanceSmartChainDexTask } from './binance-smart-chain/wault-swap.binance-smart-chain.dex.task';
import { WaultSwapBinanceSmartChainFarmTask } from '../terra-swap/wault-swap.binance-smart-chain.farm.task';

@Module({
  imports: [WaultSwapSchedulerModule, FarmModule, TokenModule, HandlerModule],
  providers: [
    WaultSwapBinanceSmartChainDexTask,
    WaultSwapBinanceSmartChainFarmTask,
  ],
  exports: [
    WaultSwapBinanceSmartChainDexTask,
    WaultSwapBinanceSmartChainFarmTask,
  ],
})
export class WaultSwapTaskModule {}
