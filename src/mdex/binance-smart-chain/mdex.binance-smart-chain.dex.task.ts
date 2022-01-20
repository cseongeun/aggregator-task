import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { MdexBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/mdex/binance-smart-chain/mdex.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class MdexBinanceSmartChainDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: MdexBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.MDEX_BINANCE_SMART_CHAIN_DEX,
      handlerService,
      tokenService,
      context,
    );
  }
}
