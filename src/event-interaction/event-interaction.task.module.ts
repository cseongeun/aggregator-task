import { Module } from '@nestjs/common';
import {
  EventModule,
  InteractionModule,
} from '@seongeun/aggregator-base/lib/module';
import { RedisModule } from '@seongeun/aggregator-common';
import { HandlerModule } from '../app/handler/handler.module';
import { EventInteractionAllMigrationTask } from './event-interaction.all.migration.task';

@Module({
  imports: [HandlerModule, RedisModule, EventModule, InteractionModule],
  providers: [EventInteractionAllMigrationTask],
  exports: [EventInteractionAllMigrationTask],
})
export class EventInteractionTaskModule {}
