import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskModule } from '@seongeun/aggregator-base/lib/module';
import { AaveTaskModule } from './aave/aave.task.module';
import { TaskAppService } from './task-app.service';
import { TaskHandlerModule } from './task-app/handler/task-handler.module';
import { MysqlConfigService } from './task-app/mysql/mysql-config.service';
import { AirNFTTaskModule } from './air-nft/air-nft.task.module';
import { ApeSwapTaskModule } from './ape-swap/ape-swap.task.module';
import { BakerySwapTaskModule } from './bakery-swap/bakery-swap.task.module';
import { BiSwapTaskModule } from './bi-swap/bi-swap.task.module';
import { KlaySwapTaskModule } from './klay-swap/klay-swap.task.module';
import { MdexTaskModule } from './mdex/mdex.task.module';
import { PancakeSwapTaskModule } from './pancake-swap/pancake-swap.task.module';
import { QuickSwapTaskModule } from './quick-swap/quick-swap.task.module';
import { SushiSwapTaskModule } from './sushi-swap/sushi-swap.task.module';
import { TerraSwapTaskModule } from './terra-swap/terra-swap.task.module';
import { VenusTaskModule } from './venus/venus.task.module';
import { WaultSwapTaskModule } from './wault-swap/wault-swap.task.module';
import { TokenPriceTaskModule } from './token-price/token-price.task.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useClass: MysqlConfigService }),
    TaskModule,
    TaskHandlerModule,

    AaveTaskModule,

    AirNFTTaskModule,

    ApeSwapTaskModule,

    BakerySwapTaskModule,

    BiSwapTaskModule,

    KlaySwapTaskModule,

    MdexTaskModule,

    PancakeSwapTaskModule,

    QuickSwapTaskModule,

    SushiSwapTaskModule,

    TerraSwapTaskModule,

    VenusTaskModule,

    WaultSwapTaskModule,

    TokenPriceTaskModule,
  ],
  providers: [TaskAppService],
  exports: [TaskAppService],
})
export class TaskAppModule {}
