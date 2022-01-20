import { Module } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { TaskModule } from '@seongeun/aggregator-base/lib/module';
import { WinstonLoggerModule } from '@seongeun/aggregator-logger';
import { Logger } from './libs/logger/logger';
import { Manager } from './libs/manager/manager';
import { Transaction } from './libs/transaction/transaction';
import { HandlerService } from './handler.service';

@Module({
  imports: [TaskModule, WinstonLoggerModule],
  providers: [HandlerService, Logger, Manager, Transaction, SchedulerRegistry],
  exports: [HandlerService],
})
export class HandlerModule {}
