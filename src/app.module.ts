import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskModule } from '@seongeun/aggregator-base/lib/module';
import { AaveTaskModule } from './aave/aave.task.module';
import { AppService } from './app.service';
import { TaskHandlerModule } from './app/handler/task-handler.module';
import { MysqlConfigService } from './app/mysql/mysql-config.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useClass: MysqlConfigService }),
    TaskModule,
    TaskHandlerModule,

    AaveTaskModule,
  ],
  providers: [AppService],
  exports: [AppService],
})
export class AppModule {}
