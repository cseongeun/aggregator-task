import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { SushiSwapFantomSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/sushi-swap/fantom/sushi-swap.fantom.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class SushiSwapFantomDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: SushiSwapFantomSchedulerService,
  ) {
    super(TASK_ID.SUSHI_SWAP_FANTOM_DEX, handlerService, tokenService, context);
  }
}
