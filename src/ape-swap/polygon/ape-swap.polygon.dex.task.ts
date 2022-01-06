import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { ApeSwapPolygonSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/ape-swap/polygon/ape-swap.polygon.scheduler.service';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { DexTaskTemplate } from '../../task-app/template/dex.task.template';

@Injectable()
export class ApeSwapPolygonDexTask extends DexTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context: ApeSwapPolygonSchedulerService,
  ) {
    super(
      TASK_ID.APE_SWAP_POLYGON_DEX,
      taskHandlerService,
      tokenService,
      context,
    );
  }
}
