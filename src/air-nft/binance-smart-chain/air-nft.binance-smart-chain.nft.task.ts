import { Injectable } from '@nestjs/common';
import { NFTokenService } from '@seongeun/aggregator-base/lib/service';
import { AirNFTBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/air-nft/binance-smart-chain/air-nft.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { NFTTaskTemplate } from '../../app/template/nft.task.template';

@Injectable()
export class AirNFTBinanceSmartChainNFTTask extends NFTTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly nfTokenService: NFTokenService,
    public readonly context: AirNFTBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.AIR_NFT_BINANCE_SMART_CHAIN_NFT,
      handlerService,
      nfTokenService,
      context,
    );
  }

  getNFTokenDetail(): { name: string; address: string } {
    const target = this.context.nfToken;
    return { name: target.name, address: target.address };
  }
}
