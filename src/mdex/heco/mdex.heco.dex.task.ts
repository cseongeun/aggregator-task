import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { MdexHecoSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/mdex/heco/mdex.heco.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class MdexHecoDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: MdexHecoSchedulerService,
  ) {
    super(TASK_ID.MDEX_HECO_DEX, handlerService, tokenService, context);
  }
}
