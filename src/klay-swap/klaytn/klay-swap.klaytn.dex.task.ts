import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import { KlaySwapKlaytnSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/klay-swap/klaytn/klay-swap.klaytn.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { DexTaskTemplate } from '../../app/template/dex.task.template';

@Injectable()
export class KlaySwapKlaytnDexTask extends DexTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context: KlaySwapKlaytnSchedulerService,
  ) {
    super(TASK_ID.KLAY_SWAP_KLAYTN_DEX, handlerService, tokenService, context);
  }
}
