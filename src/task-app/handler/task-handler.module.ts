import { Module } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { TaskModule } from '@seongeun/aggregator-base/lib/module';
import { WinstonLoggerModule } from '@seongeun/aggregator-logger';
import { TaskLogger } from '../logger/task-logger';
import { TaskManager } from '../manager/task-manager';
import { TaskHandlerService } from './task-handler.service';

@Module({
  imports: [TaskModule, WinstonLoggerModule],
  providers: [TaskHandlerService, TaskLogger, TaskManager, SchedulerRegistry],
  exports: [TaskHandlerService],
})
export class TaskHandlerModule {}
