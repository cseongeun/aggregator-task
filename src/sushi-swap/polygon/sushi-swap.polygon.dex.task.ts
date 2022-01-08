import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { SushiSwapPolygonSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/sushi-swap/polygon/sushi-swap.polygon.scheduler.service';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { DexTaskTemplate } from '../../task-app/template/dex.task.template';

@Injectable()
export class SushiSwapPolygonDexTask extends DexTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context: SushiSwapPolygonSchedulerService,
  ) {
    super(
      TASK_ID.SUSHI_SWAP_POLYGON_DEX,
      taskHandlerService,
      tokenService,
      context,
    );
  }
}
