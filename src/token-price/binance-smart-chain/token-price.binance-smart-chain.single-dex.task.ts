import { Injectable } from '@nestjs/common';
import {
  NETWORK_CHAIN_ID,
  NETWORK_CHAIN_TYPE,
} from '@seongeun/aggregator-base/lib/constant';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { TASK_ID } from '../../task-app.constant';
import { TokenPriceSingleDexTaskTemplate } from '../../task-app/template/token-price/token-price.single-dex.task.template';

@Injectable()
export class TokenPriceBinanceSmartChainSingleDexTask extends TokenPriceSingleDexTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly networkService: NetworkService,
  ) {
    super(
      TASK_ID.TOKEN_PRICE_BINANCE_SMART_CHAIN_SINGLE_DEX,
      NETWORK_CHAIN_TYPE.EVM,
      NETWORK_CHAIN_ID.BINANCE_SMART_CHAIN,
      taskHandlerService,
      tokenService,
      networkService,
    );
  }
}
