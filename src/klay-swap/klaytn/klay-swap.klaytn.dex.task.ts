import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { KlaySwapKlaytnSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/klay-swap/klaytn/klay-swap.klaytn.scheduler.service';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { DexTaskTemplate } from '../../task-app/template/dex.task.template';

@Injectable()
export class KlaySwapKlaytnDexTask extends DexTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context: KlaySwapKlaytnSchedulerService,
  ) {
    super(
      TASK_ID.KLAY_SWAP_KLAYTN_DEX,
      taskHandlerService,
      tokenService,
      context,
    );
  }
}
