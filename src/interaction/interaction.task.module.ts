import { Module } from '@nestjs/common';
import { InteractionModule } from '@seongeun/aggregator-base/lib/module';
import { RedisModule } from '@seongeun/aggregator-common';
import { HandlerModule } from '../app/handler/handler.module';
import { InteractionAllMigrationTask } from './interaction.all.migration.task';

@Module({
  imports: [HandlerModule, RedisModule, InteractionModule],
  providers: [InteractionAllMigrationTask],
  exports: [InteractionAllMigrationTask],
})
export class InteractionTaskModule {}
