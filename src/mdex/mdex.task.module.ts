import { Module } from '@nestjs/common';
import { FarmModule, TokenModule } from '@seongeun/aggregator-base/lib/module';
import { MdexSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/mdex/mdex.scheduler.module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { MdexBinanceSmartChainDexTask } from './binance-smart-chain/mdex.binance-smart-chain.dex.task';
import { MdexBinanceSmartChainFarmTask } from './binance-smart-chain/mdex.binance-smart-chain.farm.task';
import { MdexHecoDexTask } from './heco/mdex.heco.dex.task';
import { MdexHecoFarmTask } from './heco/mdex.heco.farm.task';

@Module({
  imports: [MdexSchedulerModule, FarmModule, TokenModule, TaskHandlerModule],
  providers: [
    MdexBinanceSmartChainDexTask,
    MdexBinanceSmartChainFarmTask,
    MdexHecoDexTask,
    MdexHecoFarmTask,
  ],
  exports: [
    MdexBinanceSmartChainDexTask,
    MdexBinanceSmartChainFarmTask,
    MdexHecoDexTask,
    MdexHecoFarmTask,
  ],
})
export class MdexTaskModule {}
