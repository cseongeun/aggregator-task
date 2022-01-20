import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { SushiSwapBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/sushi-swap/binance-smart-chain/sushi-swap.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class SushiSwapBinanceSmartChainDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: SushiSwapBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.SUSHI_SWAP_BINANCE_SMART_CHAIN_DEX,
      handlerService,
      tokenService,
      context,
    );
  }
}
