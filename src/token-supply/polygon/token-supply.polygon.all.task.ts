import { Injectable } from '@nestjs/common';
import {
  NETWORK_CHAIN_ID,
  NETWORK_CHAIN_TYPE,
} from '@seongeun/aggregator-base/lib/constant';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { TokenSupplyTaskTemplate } from '../../app/template/token-supply.task.template';

@Injectable()
export class TokenSupplyPolygonAllTask extends TokenSupplyTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly networkService: NetworkService,
  ) {
    super(
      TASK_ID.TOKEN_SUPPLY_POLYGON_ALL,
      NETWORK_CHAIN_TYPE.EVM,
      NETWORK_CHAIN_ID.POLYGON,
      handlerService,
      tokenService,
      networkService,
    );
  }
}
