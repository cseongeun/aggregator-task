import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { ApeSwapBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { DexTaskTemplate } from '../../task-app/template/dex.task.template';

@Injectable()
export class ApeSwapBinanceSmartChainDexTask extends DexTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context: ApeSwapBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.APE_SWAP_BINANCE_SMART_CHAIN_DEX,
      taskHandlerService,
      tokenService,
      context,
    );
  }
}
