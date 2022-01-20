import { Module } from '@nestjs/common';
import { FarmModule, TokenModule } from '@seongeun/aggregator-base/lib/module';
import { TerraSwapSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/terra-swap/terra-swap.scheduler.module';
import { HandlerModule } from '../app/handler/handler.module';
import { TerraSwapTerraDexTask } from './terra/terra-swap.terra.dex.task';

@Module({
  imports: [TerraSwapSchedulerModule, FarmModule, TokenModule, HandlerModule],
  providers: [TerraSwapTerraDexTask],
  exports: [TerraSwapTerraDexTask],
})
export class TerraSwapTaskModule {}
