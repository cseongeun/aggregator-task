import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskModule } from '@seongeun/aggregator-base/lib/module';
import { AaveTaskModule } from './aave/aave.task.module';
import { TaskAppService } from './task-app.service';
import { TaskManagerModule } from './task-app/manager/task-manager.module';
import { MysqlConfigService } from './task-app/mysql/mysql-config.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useClass: MysqlConfigService }),
    TaskModule,
    TaskManagerModule,
    AaveTaskModule,
  ],
  providers: [TaskAppService],
  exports: [TaskAppService],
})
export class TaskAppModule {}
