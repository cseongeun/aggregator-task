import { Injectable } from '@nestjs/common';
import { NFTokenService } from '@seongeun/aggregator-base/lib/service';
import { PancakeSwapBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/pancake-swap/binance-smart-chain/pancake-swap.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { NFTTaskTemplate } from '../../app/template/nft.task.template';

@Injectable()
export class PancakeSwapBinanceSmartChainNFTTask extends NFTTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly nfTokenService: NFTokenService,
    public readonly context: PancakeSwapBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.PANCAKE_SWAP_BINANCE_SMART_CHAIN_NFT,
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
