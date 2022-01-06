import { Injectable } from '@nestjs/common';
import { NFTokenService } from '@seongeun/aggregator-base/lib/service';
import { PancakeSwapBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/pancake-swap/binance-smart-chain/pancake-swap.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { NFTTaskTemplate } from '../../task-app/template/nft.task.template';

@Injectable()
export class PancakeSwapBinanceSmartChainNFT_3_Task extends NFTTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly nfTokenService: NFTokenService,
    public readonly context: PancakeSwapBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.PANCAKE_SWAP_BINANCE_SMART_CHAIN_NFT_3,
      taskHandlerService,
      nfTokenService,
      context,
    );
  }

  getNFTokenDetail(): { name: string; address: string } {
    const target = this.context.nfToken3;
    return { name: target.name, address: target.address };
  }
}
