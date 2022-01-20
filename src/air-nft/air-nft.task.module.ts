import { Module } from '@nestjs/common';
import { NFTokenModule } from '@seongeun/aggregator-base/lib/module';
import { AirNFTSchedulerModule } from '@seongeun/aggregator-defi-protocol/lib/air-nft/air-nft.scheduler.module';
import { HandlerModule } from '../app/handler/handler.module';
import { AirNFTBinanceSmartChainNFTTask } from './binance-smart-chain/air-nft.binance-smart-chain.nft.task';

@Module({
  imports: [AirNFTSchedulerModule, NFTokenModule, HandlerModule],
  providers: [AirNFTBinanceSmartChainNFTTask],
  exports: [AirNFTBinanceSmartChainNFTTask],
})
export class AirNFTTaskModule {}
