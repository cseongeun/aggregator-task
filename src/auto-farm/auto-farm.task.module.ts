import { Module } from '@nestjs/common';
import { FarmModule, TokenModule } from '@seongeun/aggregator-base/lib/module';
import { AutoFarmSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/auto-farm/auto-farm.scheduler.module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { AutoFarmBinanceSmartChainFarmTask } from './binance-smart-chain/auto-farm.binance-smart-chain.farm.task';

@Module({
  imports: [
    AutoFarmSchedulerModule,
    TokenModule,
    FarmModule,
    TaskHandlerModule,
  ],
  providers: [],
  exports: [],
})
export class AutoFarmTaskModule {}
