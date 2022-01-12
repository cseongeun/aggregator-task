import { Injectable } from '@nestjs/common';
import BigNumberJs from 'bignumber.js';
import {
  TOKEN_PRICE_ORACLE_TYPE,
  TOKEN_TYPE,
} from '@seongeun/aggregator-base/lib/constant';
import { Network, Token } from '@seongeun/aggregator-base/lib/entity';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import { TASK_EXCEPTION_LEVEL } from '../../../exception/task-exception.constant';
import { TokenPriceBaseService } from './service.base';
import { retryWrap } from '@seongeun/aggregator-util/lib/retry-wrapper';
import { getBatchStaticAggregator } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import { Provider } from '@ethersproject/providers';
import {
  flat,
  toSplitWithChunkSize,
  zip,
} from '@seongeun/aggregator-util/lib/array';
import { QueryRunner } from 'typeorm';
import {
  div,
  isZero,
  mul,
  toFixed,
} from '@seongeun/aggregator-util/lib/bignumber';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import { TaskHandlerService } from '../../../handler/task-handler.service';
import {
  decodeFunctionResultData,
  encodeFunction,
  validResult,
} from '@seongeun/aggregator-util/lib/encodeDecode';
import { ERC20_ABI } from '@seongeun/aggregator-util/lib/erc20';
import { ZERO } from '@seongeun/aggregator-util/lib/constant';

interface ITokenExtendBestPair extends Token {
  bestPair: Token;
}
@Injectable()
export class TokenPriceMultiDexService extends TokenPriceBaseService {
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
      type: TOKEN_TYPE.MULTI,
    });
  }

  /**
   * 인증된 페어 고르기(체인링크를 통해 가격정보를 받아오는 토큰)
   * @param token verified oracle pair
   */
  getTokenWithBestPair(tokens: Token[]): ITokenExtendBestPair[] {
    try {
      const tokenZip: ITokenExtendBestPair[] = [];

      tokens.map((token: ITokenExtendBestPair) => {
        const { pair0, pair1 } = token;

        if (!isNull(pair0) || !isUndefined(pair0))
          if (!isNull(pair0.tokenPrice)) {
            const {
              tokenPrice: { oracleType: pair0OracleType, value: pair0Value },
            } = pair0;

            if (
              pair0OracleType === TOKEN_PRICE_ORACLE_TYPE.CHAIN_LINK &&
              !isNull(pair0Value)
            ) {
              token.bestPair = pair0;
              tokenZip.push(token);
              return;
            }
          }

        if (!isNull(pair1) || !isUndefined(pair1)) {
          if (!isNull(pair1.tokenPrice)) {
            const {
              tokenPrice: { oracleType: pair1OracleType, value: pair1Value },
            } = pair1;

            if (
              pair1OracleType === TOKEN_PRICE_ORACLE_TYPE.CHAIN_LINK &&
              !isNull(pair1Value)
            ) {
              token.bestPair = pair1;
              tokenZip.push(token);
              return;
            }
          }
        }
      });

      return tokenZip;
    } catch (e) {
      throw Error(e);
    }
  }

  /**
   * 가격 정보를 가져오기위한 필요 데이터 인코딩
   * @param tokenWithBestPair 토큰과 안정적인 가격을 추적할 수 있는 페어
   * @returns 인코딩 데이터
   */
  getInfoDataEncoding(tokenWithBestPair: ITokenExtendBestPair[]): any[][] {
    return tokenWithBestPair.map((token: ITokenExtendBestPair) => {
      const { address, bestPair } = token;

      return [
        [address, encodeFunction(ERC20_ABI, 'totalSupply')],
        [bestPair.address, encodeFunction(ERC20_ABI, 'balanceOf', [address])],
      ];
    });
  }

  /**
   * 가격 산출을 위한 필요 데이터 디코딩
   * @param batchCallMap 가격 산출을 위한 필요 데이터 요청 결과 묶음
   * @param extraData 관련 토큰 데시멸
   * @returns 디코딩 데이터
   */
  getInfoDataDecoding(
    batchCallMap: any[],
    extraData: { multiTokenDecimals: number; bestPairTokenDecimals: number },
  ): { multiTokenSupply: BigNumberJs; bestPairBalance: BigNumberJs } {
    const [
      {
        success: multiTokenTotalSupplySuccess,
        returnData: multiTokenTotalSupplyData,
      },
      {
        success: bestPairTokenBalanceSuccess,
        returnData: bestPairTokenBalanceData,
      },
    ] = batchCallMap;

    const multiTokenSupply = validResult(
      multiTokenTotalSupplySuccess,
      multiTokenTotalSupplyData,
    )
      ? divideDecimals(
          decodeFunctionResultData(
            ERC20_ABI,
            'totalSupply',
            multiTokenTotalSupplyData,
          ),
          extraData.multiTokenDecimals,
        )
      : ZERO;

    const bestPairBalance = validResult(
      bestPairTokenBalanceSuccess,
      bestPairTokenBalanceData,
    )
      ? divideDecimals(
          decodeFunctionResultData(
            ERC20_ABI,
            'balanceOf',
            bestPairTokenBalanceData,
          ),
          extraData.bestPairTokenDecimals,
        )
      : ZERO;

    return { multiTokenSupply, bestPairBalance };
  }

  async trackingPrice(data: {
    network: Network;
    tokens: Token[];
    today: string;
    maxHistoricalRecordDays: number;
  }): Promise<void> {
    try {
      const { network, tokens, today, maxHistoricalRecordDays } = data;

      const tokenWithBestPairZip = this.getTokenWithBestPair(tokens);

      const infoDataEncode = this.getInfoDataEncoding(tokenWithBestPairZip);

      const infoDataBatchCall = await retryWrap(
        getBatchStaticAggregator(
          this.networkService.provider(network.chainKey) as Provider,
          this.networkService.multiCallAddress(network.chainKey),
          flat(infoDataEncode),
        ),
      );

      const infoDataBatchCallMap = toSplitWithChunkSize(infoDataBatchCall, 2);
      const tokenWithInfoBatchCallZip = zip(
        tokenWithBestPairZip,
        infoDataBatchCallMap,
      );

      for await (const [token, batchCallMap] of tokenWithInfoBatchCallZip) {
        let queryRunner: QueryRunner | null = null;

        try {
          const { decimals, bestPair } = token;
          const {
            decimals: bestPairDecimals,
            tokenPrice: { value: bestPairValue },
          } = bestPair;

          const { bestPairBalance, multiTokenSupply } =
            this.getInfoDataDecoding(batchCallMap, {
              multiTokenDecimals: decimals,
              bestPairTokenDecimals: bestPairDecimals,
            });

          const bestPairTotalValue = mul(bestPairBalance, bestPairValue);
          const multiTokenTotalValue = mul(bestPairTotalValue, 2);

          const multiTokenValue = isZero(multiTokenSupply)
            ? ZERO
            : div(multiTokenTotalValue, multiTokenSupply);

          const value = toFixed(multiTokenValue);

          const historicalValue = {
            ...this.removePastMaxHistoricalDays(
              token?.tokenPrice?.historicalValue,
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
