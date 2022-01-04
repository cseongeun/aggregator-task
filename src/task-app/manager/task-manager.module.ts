import { Module } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { TaskManagerService } from './task-manager.service';

@Module({
  imports: [],
  providers: [SchedulerRegistry, TaskManagerService],
  exports: [TaskManagerService],
})
export class TaskManagerModule {}
