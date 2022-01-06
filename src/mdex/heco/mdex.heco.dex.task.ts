import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { MdexHecoSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/mdex/heco/mdex.heco.scheduler.service';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { DexTaskTemplate } from '../../task-app/template/dex.task.template';

@Injectable()
export class MdexHecoDexTask extends DexTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context: MdexHecoSchedulerService,
  ) {
    super(TASK_ID.MDEX_HECO_DEX, taskHandlerService, tokenService, context);
  }
}
