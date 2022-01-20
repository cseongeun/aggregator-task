import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { BakerySwapBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/bakery-swap/binance-smart-chain/bakery-swap.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class BakerySwapBinanceSmartChainDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: BakerySwapBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.BAKERY_SWAP_BINANCE_SMART_CHAIN_DEX,
      handlerService,
      tokenService,
      context,
    );
  }
}
