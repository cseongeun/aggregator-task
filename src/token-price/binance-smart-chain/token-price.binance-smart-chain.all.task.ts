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
import { TokenPriceBaseService } from '../../task-app/template/token-price/service/service.base';
import { TokenPriceChainLinkService } from '../../task-app/template/token-price/service/token-price.chain-link-oracle.service';
import { TokenPriceMultiDexService } from '../../task-app/template/token-price/service/token-price.multi-dex.service';
import { TokenPriceSingleDexService } from '../../task-app/template/token-price/service/token-price.single-dex.service';
import { TokenPriceTaskTemplate } from '../../task-app/template/token-price/token-price.task.template';

@Injectable()
export class TokenPriceBinanceSmartChainAllTask extends TokenPriceTaskTemplate {
  network: Network;

  constructor(
    public readonly networkService: NetworkService,
    public readonly tokenService: TokenService,
    public readonly taskHandlerService: TaskHandlerService,

    // jobs
    public readonly tokenPriceChainLinkService: TokenPriceChainLinkService,
    public readonly tokenPriceMultiDexService: TokenPriceMultiDexService,
    public readonly tokenPriceSingleDexService: TokenPriceSingleDexService,
  ) {
    super(
      TASK_ID.TOKEN_PRICE_BINANCE_SMART_CHAIN_ALL,
      NETWORK_CHAIN_TYPE.EVM,
      NETWORK_CHAIN_ID.BINANCE_SMART_CHAIN,
      taskHandlerService,
      tokenService,
      networkService,
    );
  }

  getTokenPriceServiceMapLogLabel(): {
    label: string;
    service: TokenPriceBaseService;
  }[] {
    return [
      { label: 'chainLink', service: this.tokenPriceChainLinkService },
      {
        label: 'multiDex',
        service: this.tokenPriceMultiDexService,
      },
      {
        label: 'singleDex',
        service: this.tokenPriceSingleDexService,
      },
    ];
  }
}
