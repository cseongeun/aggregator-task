import { Module } from '@nestjs/common';
import { FarmModule, TokenModule } from '@seongeun/aggregator-base/lib/module';
import { SushiSwapSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/sushi-swap/sushi-swap.scheduler.module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { SushiSwapAvalancheDexTask } from './avalanche/sushi-swap.avalanche.dex.task';
import { SushiSwapFantomDexTask } from './fantom/sushi-swap.fantom.dex.task';
import { SushiSwapBinanceSmartChainDexTask } from './binance-smart-chain/sushi-swap.binance-smart-chain.dex.task';
import { SushiSwapHecoDexTask } from './heco/sushi-swap.heco.dex.task';
import { SushiSwapPolygonDexTask } from './polygon/sushi-swap.polygon.dex.task';
import { SushiSwapPolygonFarmTask } from './polygon/sushi-swap.polygon.farm.task';

@Module({
  imports: [
    SushiSwapSchedulerModule,
    FarmModule,
    TokenModule,
    TaskHandlerModule,
  ],
  providers: [
    SushiSwapAvalancheDexTask,
    SushiSwapFantomDexTask,
    SushiSwapBinanceSmartChainDexTask,
    SushiSwapHecoDexTask,
    SushiSwapPolygonDexTask,
    SushiSwapPolygonFarmTask,
  ],
  exports: [
    SushiSwapAvalancheDexTask,
    SushiSwapFantomDexTask,
    SushiSwapBinanceSmartChainDexTask,
    SushiSwapHecoDexTask,
    SushiSwapPolygonDexTask,
    SushiSwapPolygonFarmTask,
  ],
})
export class SushiSwapTaskModule {}
