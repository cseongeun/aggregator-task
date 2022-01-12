import { Injectable } from '@nestjs/common';
import {
  NETWORK_CHAIN_ID,
  NETWORK_CHAIN_TYPE,
} from '@seongeun/aggregator-base/lib/constant';
import { Network, Token } from '@seongeun/aggregator-base/lib/entity';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { TaskHandlerService } from '../task-app/handler/task-handler.service';

@Injectable()
export abstract class TokenPriceMainTaskTemplate {
  network: Network;

  constructor(
    public readonly id: string,
    public readonly chainType: NETWORK_CHAIN_TYPE,
    public readonly chainId: NETWORK_CHAIN_ID,
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly networkService: NetworkService,
  ) {}
}
