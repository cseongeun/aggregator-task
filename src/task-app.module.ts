import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskModule } from '@seongeun/aggregator-base/lib/module';
import { AaveTaskModule } from './aave/aave.task.module';
import { TaskAppService } from './task-app.service';
import { TaskHandlerModule } from './task-app/handler/task-handler.module';
import { MysqlConfigService } from './task-app/mysql/mysql-config.service';
import { AirNFTTaskModule } from './air-nft/air-nft.task.module';
import { ApeSwapTaskModule } from './ape-swap/ape-swap.task.module';
import { AutoFarmTaskModule } from './auto-farm/auto-farm.task.module';
import { BakerySwapTaskModule } from './bakery-swap/bakery-swap.task.module';
import { BiSwapTaskModule } from './bi-swap/bi-swap.task.module';
import { KlaySwapTaskModule } from './klay-swap/klay-swap.task.module';
import { MdexTaskModule } from './mdex/mdex.task.module';
import { PancakeSwapTaskModule } from './pancake-swap/pancake-swap.task.module';
import { QuickSwapModule } from './quick-swap/quick-swap.task.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useClass: MysqlConfigService }),
    TaskModule,
    TaskHandlerModule,

    AaveTaskModule,

    AirNFTTaskModule,

    ApeSwapTaskModule,

    AutoFarmTaskModule,

    BakerySwapTaskModule,

    BiSwapTaskModule,

    KlaySwapTaskModule,

    MdexTaskModule,

    PancakeSwapTaskModule,

    QuickSwapModule,
  ],
  providers: [TaskAppService],
  exports: [TaskAppService],
})
export class TaskAppModule {}
