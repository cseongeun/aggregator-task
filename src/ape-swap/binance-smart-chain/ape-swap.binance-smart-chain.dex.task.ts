import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { ApeSwapBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/ape-swap/binance-smart-chain/ape-swap.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class ApeSwapBinanceSmartChainDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: ApeSwapBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.APE_SWAP_BINANCE_SMART_CHAIN_DEX,
      handlerService,
      tokenService,
      context,
    );
  }
}
