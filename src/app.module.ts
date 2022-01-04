import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskModule } from '@seongeun/aggregator-base/lib/module';
import { AaveTaskModule } from './aave/aave.task.module';
import { AppService } from './app.service';
import { TaskManagerModule } from './app/manager/task-manager.module';
import { MysqlConfigService } from './app/mysql/mysql-config.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useClass: MysqlConfigService }),
    TaskModule,
    TaskManagerModule,
    AaveTaskModule,
  ],
  providers: [AppService],
  exports: [AppService],
})
export class AppModule {}
