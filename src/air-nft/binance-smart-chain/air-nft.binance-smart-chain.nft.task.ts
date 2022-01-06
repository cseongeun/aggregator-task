import { Injectable } from '@nestjs/common';
import { NFTokenService } from '@seongeun/aggregator-base/lib/service';
import { AirNFTBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { NFTTaskTemplate } from '../../task-app/template/nft.task.template';

@Injectable()
export class AirNFTBinanceSmartChainNFTTask extends NFTTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly nfTokenService: NFTokenService,
    public readonly context: AirNFTBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.AIR_NFT_BINANCE_SMART_CHAIN_NFT,
      taskHandlerService,
      nfTokenService,
      context,
    );
  }

  getNFTokenDetail(): { name: string; address: string } {
    const target = this.context.nfToken;
    return { name: target.name, address: target.address };
  }
}
