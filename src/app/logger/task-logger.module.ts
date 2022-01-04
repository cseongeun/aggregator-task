import { Module } from '@nestjs/common';
import { WinstonLoggerModule } from '@seongeun/aggregator-logger';
import { TaskLoggerService } from './task-logger.service';

@Module({
  imports: [WinstonLoggerModule],
  providers: [TaskLoggerService],
  exports: [TaskLoggerService],
})
export class TaskLoggerModule {}
