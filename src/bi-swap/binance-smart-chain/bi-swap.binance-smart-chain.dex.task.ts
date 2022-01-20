import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { BiSwapBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/bi-swap/binance-smart-chain/bi-swap.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class BiSwapBinanceSmartChainDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: BiSwapBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.BI_SWAP_BINANCE_SMART_CHAIN_DEX,
      handlerService,
      tokenService,
      context,
    );
  }
}
