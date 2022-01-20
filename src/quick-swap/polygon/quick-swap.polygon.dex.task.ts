import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { QuickSwapPolygonSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/quick-swap/polygon/quick-swap.polygon.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class QuickSwapPolygonDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: QuickSwapPolygonSchedulerService,
  ) {
    super(
      TASK_ID.QUICK_SWAP_POLYGON_DEX,
      handlerService,
      tokenService,
      context,
    );
  }
}
