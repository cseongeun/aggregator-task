import { Injectable } from '@nestjs/common';
import {
  NETWORK_CHAIN_ID,
  NETWORK_CHAIN_TYPE,
} from '@seongeun/aggregator-base/lib/constant';
import { Network } from '@seongeun/aggregator-base/lib/entity';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { TokenPriceTaskTemplate } from '../../task-app/template/token-price.task.template';
import { TaskBase } from '../../task.base';

@Injectable()
export class TokenPriceAvalancheChainLink extends TokenPriceTaskTemplate {
  network: Network;

  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly networkService: NetworkService,
  ) {
    super(
      TASK_ID.TOKEN_PRICE_AVALANCHE_CHAIN_LINK,
      NETWORK_CHAIN_ID.AVALANCHE,
      NETWORK_CHAIN_TYPE.EVM,
      taskHandlerService,
      tokenService,
      networkService,
    );
  }
}
