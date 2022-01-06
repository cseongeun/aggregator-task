import { Module } from '@nestjs/common';
import { TokenModule } from '@seongeun/aggregator-base/lib/module';
import { KlaySwapSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/klay-swap/klay-swap.scheduler.module';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { KlaySwapKlaytnDexTask } from './klaytn/klay-swap.klaytn.dex.task';

@Module({
  imports: [KlaySwapSchedulerModule, TokenModule, TaskHandlerModule],
  providers: [KlaySwapKlaytnDexTask],
  exports: [KlaySwapKlaytnDexTask],
})
export class KlaySwapTaskModule {}
