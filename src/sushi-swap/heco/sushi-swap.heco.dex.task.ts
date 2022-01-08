import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { SushiSwapHecoSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/sushi-swap/heco/sushi-swap.heco.scheduler.service';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { DexTaskTemplate } from '../../task-app/template/dex.task.template';

@Injectable()
export class SushiSwapHecoDexTask extends DexTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context: SushiSwapHecoSchedulerService,
  ) {
    super(
      TASK_ID.SUSHI_SWAP_HECO_DEX,
      taskHandlerService,
      tokenService,
      context,
    );
  }
}
