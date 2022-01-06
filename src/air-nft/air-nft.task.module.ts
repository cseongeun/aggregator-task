import { Module } from '@nestjs/common';
import { NFTokenModule } from '@seongeun/aggregator-base/lib/module';
import { AirNFTSchedulerModule } from '@seongeun/aggregator-defi-protocol';
import { TaskHandlerModule } from '../task-app/handler/task-handler.module';
import { AirNFTBinanceSmartChainNFTTask } from './binance-smart-chain/air-nft.binance-smart-chain.nft.task';

@Module({
  imports: [AirNFTSchedulerModule, NFTokenModule, TaskHandlerModule],
  providers: [AirNFTBinanceSmartChainNFTTask],
  exports: [AirNFTBinanceSmartChainNFTTask],
})
export class AirNFTTaskModule {}
