import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { SushiSwapHecoSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/sushi-swap/heco/sushi-swap.heco.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class SushiSwapHecoDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: SushiSwapHecoSchedulerService,
  ) {
    super(TASK_ID.SUSHI_SWAP_HECO_DEX, handlerService, tokenService, context);
  }
}
