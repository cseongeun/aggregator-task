import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { ApeSwapPolygonSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/ape-swap/polygon/ape-swap.polygon.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class ApeSwapPolygonDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: ApeSwapPolygonSchedulerService,
  ) {
    super(TASK_ID.APE_SWAP_POLYGON_DEX, handlerService, tokenService, context);
  }
}
