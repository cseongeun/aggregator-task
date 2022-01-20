import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { SushiSwapPolygonSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/sushi-swap/polygon/sushi-swap.polygon.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class SushiSwapPolygonDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: SushiSwapPolygonSchedulerService,
  ) {
    super(
      TASK_ID.SUSHI_SWAP_POLYGON_DEX,
      handlerService,
      tokenService,
      context,
    );
  }
}
