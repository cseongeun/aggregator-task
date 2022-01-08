import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { PancakeSwapBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/pancake-swap/binance-smart-chain/pancake-swap.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { DexTaskTemplate } from '../../task-app/template/dex.task.template';

@Injectable()
export class PancakeSwapBinanceSmartChainDexTask extends DexTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context: PancakeSwapBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.PANCAKE_SWAP_BINANCE_SMART_CHAIN_DEX,
      taskHandlerService,
      tokenService,
      context,
    );
  }
}