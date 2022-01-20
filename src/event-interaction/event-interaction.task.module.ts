import { Module } from '@nestjs/common';
import { RedisModule } from '@seongeun/aggregator-common';
import { HandlerModule } from '../app/handler/handler.module';
import { EventInteractionAllMigrationTask } from './event-interaction.all.migration.task';
@Module({
  imports: [HandlerModule, RedisModule],
  providers: [EventInteractionAllMigrationTask],
  exports: [EventInteractionAllMigrationTask],
})
export class EventInteractionTaskModule {}
