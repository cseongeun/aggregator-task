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
import { TASK_ID } from '../../app.constant';
import { HandlerService } from '../../app/handler/handler.service';
import { TokenPriceBaseService } from '../../app/template/token-price/service/service.base';
import { TokenPriceChainLinkService } from '../../app/template/token-price/service/token-price.chain-link-oracle.service';
import { TokenPriceMultiDexService } from '../../app/template/token-price/service/token-price.multi-dex.service';
import { TokenPriceSingleDexService } from '../../app/template/token-price/service/token-price.single-dex.service';
import { TokenPriceTaskTemplate } from '../../app/template/token-price/token-price.task.template';

@Injectable()
export class TokenPriceHecoAllTask extends TokenPriceTaskTemplate {
  network: Network;

  constructor(
    public readonly networkService: NetworkService,
    public readonly tokenService: TokenService,
    public readonly handlerService: HandlerService,

    // jobs
    public readonly tokenPriceChainLinkService: TokenPriceChainLinkService,
    public readonly tokenPriceMultiDexService: TokenPriceMultiDexService,
    public readonly tokenPriceSingleDexService: TokenPriceSingleDexService,
  ) {
    super(
      TASK_ID.TOKEN_PRICE_HECO_ALL,
      NETWORK_CHAIN_TYPE.EVM,
      NETWORK_CHAIN_ID.HECO,
      handlerService,
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
