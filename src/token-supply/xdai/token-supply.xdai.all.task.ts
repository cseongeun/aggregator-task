import { Injectable } from '@nestjs/common';
import {
  NETWORK_CHAIN_ID,
  NETWORK_CHAIN_TYPE,
} from '@seongeun/aggregator-base/lib/constant';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { TokenSupplyTaskTemplate } from '../../task-app/template/token-supply.task.template';

@Injectable()
export class TokenSupplyXdaiAllTask extends TokenSupplyTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly networkService: NetworkService,
  ) {
    super(
      TASK_ID.TOKEN_SUPPLY_XDAI_ALL,
      NETWORK_CHAIN_TYPE.EVM,
      NETWORK_CHAIN_ID.XDAI,
      taskHandlerService,
      tokenService,
      networkService,
    );
  }
}
