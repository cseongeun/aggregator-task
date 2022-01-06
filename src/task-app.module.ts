import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskModule } from '@seongeun/aggregator-base/lib/module';
import { AaveTaskModule } from './aave/aave.task.module';
import { TaskAppService } from './task-app.service';
import { TaskHandlerModule } from './task-app/handler/task-handler.module';
import { MysqlConfigService } from './task-app/mysql/mysql-config.service';
import { AirNFTTaskModule } from './air-nft/air-nft.task.module';
import { ApeSwapTaskModule } from './ape-swap/ape-swap.task.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useClass: MysqlConfigService }),
    TaskModule,
    TaskHandlerModule,

    AaveTaskModule,

    AirNFTTaskModule,

    ApeSwapTaskModule,
  ],
  providers: [TaskAppService],
  exports: [TaskAppService],
})
export class TaskAppModule {}
