import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { SushiSwapAvalancheSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/sushi-swap/avalanche/sushi-swap.avalanche.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class SushiSwapAvalancheDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: SushiSwapAvalancheSchedulerService,
  ) {
    super(
      TASK_ID.SUSHI_SWAP_AVALANCHE_DEX,
      handlerService,
      tokenService,
      context,
    );
  }
}
