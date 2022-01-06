import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { QuickSwapPolygonSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/quick-swap/polygon/quick-swap.polygon.scheduler.service';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { DexTaskTemplate } from '../../task-app/template/dex.task.template';

@Injectable()
export class QuickSwapPolygonDexTask extends DexTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context: QuickSwapPolygonSchedulerService,
  ) {
    super(
      TASK_ID.QUICK_SWAP_POLYGON_DEX,
      taskHandlerService,
      tokenService,
      context,
    );
  }
}
