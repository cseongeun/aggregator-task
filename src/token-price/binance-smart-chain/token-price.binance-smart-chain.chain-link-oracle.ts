import { Injectable } from '@nestjs/common';
import { TOKEN_PRICE_ORACLE_TYPE } from '@seongeun/aggregator-base/lib/constant';
import {
  Network,
  Token,
  TokenPrice,
} from '@seongeun/aggregator-base/lib/entity';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { toSplitWithChunkSize, zip } from '@seongeun/aggregator-util/lib/array';
import { get } from '@seongeun/aggregator-util/lib/object';
import { getToday } from '@seongeun/aggregator-util/lib/time';
import { IsNull, Not } from 'typeorm';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import { getBatchChainLinkData } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import { Provider } from '@ethersproject/providers';
import { isZero, toFixed } from '@seongeun/aggregator-util/lib/bignumber';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import { TaskBase } from '../../task.base';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { TASK_EXCEPTION_CODE } from '../../task-app/exception/task-exception.constant';
import { TASK_ID } from '../../task-app.constant';

@Injectable()
export class TokenPriceBinance extends TaskBase {
  network: Network;

  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly networkService: NetworkService,
  ) {
    super(
      TASK_ID.TOKEN_PRICE_BINANCE_SMART_CHAIN_CHAIN_LINK_ORACLE,
      taskHandlerService,
    );
  }

  async onModuleInit(): Promise<void> {
    // task base
    super.onModuleInit();

    this.network = await this.networkService.repository.findOneBy({
      chainId: '56',
      chainType: 'EVM',
    });

    console.log(this.network);
  }

  loggingForm(): Record<string, any> {
    return {};
  }

  async getTargetTotalTokens() {
    return this.tokenService.repository.findAllBy({
      network: this.network,
      tokenPrice: {
        oracleType: TOKEN_PRICE_ORACLE_TYPE.CHAIN_LINK,
        oracleData: Not(IsNull()),
      },
    });
  }

  async getChunkSize(): Promise<number> {
    const task = await this.taskHandlerService.getTask(this.taskId);
    return parseInt(get(task.config, 'chunk'), 10) || 100;
  }

  async process(data: {
    tokens: Token[];
    today: string;
  }): Promise<Record<string, any>> {
    try {
      const { tokens, today } = data;

      const feedAddresses = tokens.map(({ tokenPrice: { oracleData } }) => {
        const feed = get(oracleData, 'feed');

        if (isUndefined(feed)) {
          throw new Error(TASK_EXCEPTION_CODE.ERR2000);
        }

        return feed;
      });

      const chainLinkBatchCall = await getBatchChainLinkData(
        this.networkService.provider(this.network.chainKey) as Provider,
        this.networkService.multiCallAddress(this.network.chainKey),
        feedAddresses,
      );

      const tokenWithChainLink = zip(tokens, chainLinkBatchCall);

      for await (const [token, chainLinkData] of tokenWithChainLink) {
        const { id, tokenPrice } = token;

        const { answer, decimals: chainLinkPriceDecimals } = chainLinkData;

        if (isZero(answer) || isZero(chainLinkPriceDecimals)) continue;

        const priceUSD = toFixed(
          divideDecimals(answer, chainLinkPriceDecimals),
        );

        console.log(priceUSD);
        // await this.tokenService.updateTokenPrice(id, {
        //   value: priceUSD,
        //   historical_value: Object.assign(
        //     {},
        //     {
        //       [today]: priceUSD,
        //     },
        //   ),
        // });
      }

      return;
    } catch (e) {
      console.log(e);
      throw Error(e);
    }
  }

  async run(): Promise<Record<string, any>> {
    try {
      const [totalTokens, chunkSize, today] = await Promise.all([
        this.getTargetTotalTokens(),
        this.getChunkSize(),
        getToday(),
      ]);
      console.log(totalTokens.length);

      const chunkTokens: Token[][] = toSplitWithChunkSize(
        totalTokens,
        chunkSize,
      );

      for await (const tokens of chunkTokens) {
        await this.process({ tokens, today });
      }

      return;
    } catch (e) {}
  }
}
