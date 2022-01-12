import { Injectable } from '@nestjs/common';
import {
  TOKEN_PRICE_ORACLE_TYPE,
  TOKEN_TYPE,
} from '@seongeun/aggregator-base/lib/constant';
import { Network, Token } from '@seongeun/aggregator-base/lib/entity';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { get } from '@seongeun/aggregator-util/lib/object';
import { isUndefined } from '@seongeun/aggregator-util/lib/type';
import {
  TASK_EXCEPTION_CODE,
  TASK_EXCEPTION_LEVEL,
} from '../../../exception/task-exception.constant';
import { TokenPriceBaseService } from './service.base';
import { retryWrap } from '@seongeun/aggregator-util/lib/retry-wrapper';
import { getBatchChainLinkData } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import { Provider } from '@ethersproject/providers';
import { zip } from '@seongeun/aggregator-util/lib/array';
import { QueryRunner } from 'typeorm';
import { isZero, toFixed } from '@seongeun/aggregator-util/lib/bignumber';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import { TaskHandlerService } from '../../../handler/task-handler.service';

@Injectable()
export class TokenPriceChainLinkService extends TokenPriceBaseService {
  constructor(
    public readonly networkService: NetworkService,
    public readonly tokenService: TokenService,
    public readonly taskHandlerService: TaskHandlerService,
  ) {
    super(networkService, tokenService, taskHandlerService);
  }

  /**
   * 체인링크 오라클을 사용하여 가격 정보를 가져오는 네트워크 토큰 가져오기
   * @returns 토큰
   */
  async getTargetTotalTokens(network: Network): Promise<Token[]> {
    return this.tokenService.search({
      networkId: network.id,
      type: [TOKEN_TYPE.NATIVE, TOKEN_TYPE.SINGLE],
      oracleType: TOKEN_PRICE_ORACLE_TYPE.CHAIN_LINK,
    });
  }

  /**
   * 체인링크 가격 정보 가져오기
   * @param tokens 토큰
   * @returns 체인링크 가격 정보
   */
  async getChainLinkData(network: Network, tokens: Token[]): Promise<any> {
    const feedAddresses = tokens.map(({ tokenPrice: { oracleData } }) => {
      const feed = get(oracleData, 'feed');

      // console.log(tokenPrice);
      if (isUndefined(feed)) {
        throw Error(TASK_EXCEPTION_CODE.ERR2000);
      }

      return feed;
    });

    const chainLinkBatchCall = await retryWrap(
      getBatchChainLinkData(
        this.networkService.provider(network.chainKey) as Provider,
        this.networkService.multiCallAddress(network.chainKey),
        feedAddresses,
      ),
    );

    return chainLinkBatchCall;
  }

  async trackingPrice(data: {
    network: Network;
    tokens: Token[];
    today: string;
    maxHistoricalRecordDays: number;
  }): Promise<void> {
    try {
      const { network, tokens, today, maxHistoricalRecordDays } = data;

      const chainLinkBatchCall = await this.getChainLinkData(network, tokens);

      const tokenWithChainLink = zip(tokens, chainLinkBatchCall);

      for await (const [token, chainLinkData] of tokenWithChainLink) {
        let queryRunner: QueryRunner | null = null;

        try {
          const { answer, decimals: chainLinkPriceDecimals } = chainLinkData;

          if (isZero(answer) || isZero(chainLinkPriceDecimals)) continue;

          const value = toFixed(divideDecimals(answer, chainLinkPriceDecimals));

          const historicalValue = {
            ...this.removePastMaxHistoricalDays(
              token.tokenPrice.historicalValue,
              maxHistoricalRecordDays,
            ),
            [today]: value,
          };

          queryRunner =
            await this.taskHandlerService.transaction.startTransaction();

          await this.tokenService.updateTokenPrice(
            token,
            {
              value,
              historicalValue,
            },
            queryRunner.manager,
          );
          await this.taskHandlerService.transaction.commitTransaction(
            queryRunner,
          );
        } catch (e) {
          await this.taskHandlerService.transaction.rollbackTransaction(
            queryRunner,
          );

          const wrappedError = this.taskHandlerService.wrappedError(e);

          // 인터널 노말 에러 시
          if (wrappedError.level === TASK_EXCEPTION_LEVEL.NORMAL) {
            continue;
          }

          throw Error(e);
        } finally {
          await this.taskHandlerService.transaction.releaseTransaction(
            queryRunner,
          );
        }
      }
    } catch (e) {
      throw Error(e);
    }
  }
}
