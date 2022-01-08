import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { SushiSwapFantomSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/sushi-swap/fantom/sushi-swap.fantom.scheduler.service';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { DexTaskTemplate } from '../../task-app/template/dex.task.template';

@Injectable()
export class SushiSwapFantomDexTask extends DexTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context: SushiSwapFantomSchedulerService,
  ) {
    super(
      TASK_ID.SUSHI_SWAP_FANTOM_DEX,
      taskHandlerService,
      tokenService,
      context,
    );
  }
}
