import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { WaultSwapBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/wault-swap/binance-smart-chain/wault-swap.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class WaultSwapBinanceSmartChainDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: WaultSwapBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.WAULT_SWAP_BINANCE_SMART_CHAIN_DEX,
      handlerService,
      tokenService,
      context,
    );
  }
}
