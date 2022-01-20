import { Injectable } from '@nestjs/common';
import BigNumberJs from 'bignumber.js';
import { TOKEN_TYPE } from '@seongeun/aggregator-base/lib/constant';
import { Network, Token } from '@seongeun/aggregator-base/lib/entity';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { isNull } from '@seongeun/aggregator-util/lib/type';
import { getBatchStaticAggregator } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import { Provider } from '@ethersproject/providers';
import {
  flat,
  toSplitWithChunkSize,
  zip,
} from '@seongeun/aggregator-util/lib/array';
import { IsNull, Not, QueryRunner } from 'typeorm';
import {
  div,
  isGreaterThan,
  isZero,
  mul,
  toFixed,
} from '@seongeun/aggregator-util/lib/bignumber';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import {
  decodeFunctionResultData,
  encodeFunction,
  validResult,
} from '@seongeun/aggregator-util/lib/encodeDecode';
import { ERC20_ABI } from '@seongeun/aggregator-util/lib/erc20';
import { ZERO } from '@seongeun/aggregator-util/lib/constant';
import { EXCEPTION_LEVEL } from '../../../exception/exception.constant';
import { TokenPriceBaseService } from './service.base';
import { HandlerService } from '../../../handler/handler.service';

interface ITokenExtendBestTVLPairWithOther extends Token {
  bestTVLPair: Token;
  other: Token;
}

@Injectable()
export class TokenPriceSingleDexService extends TokenPriceBaseService {
  constructor(
    public readonly networkService: NetworkService,
    public readonly tokenService: TokenService,
    public readonly handlerService: HandlerService,
  ) {
    super(networkService, tokenService, handlerService);
  }

  /**
   * 싱글 타입 네트워크 토큰 가져오기
   * @returns 토큰
   */
  async getTargetTotalTokens(network: Network): Promise<Token[]> {
    return this.tokenService.search({
      networkId: network.id,
      type: TOKEN_TYPE.SINGLE,
      oracleType: null,
    });
  }

  /**
   * 싱글 토큰이 포함된 페어 중 가장 TVL이 높은 페어 선택
   * @param tokens 추적하는 싱글 토큰들
   * @returns 토큰 & 가장 높은 TVL 페어 & 페어 중 다른 한쌍
   */
  async getTokenWithBestTVLPair(
    tokens: Token[],
  ): Promise<ITokenExtendBestTVLPairWithOther[]> {
    try {
      const tokenZip: ITokenExtendBestTVLPairWithOther[] = [];

      await Promise.all(
        tokens.map(async (token: ITokenExtendBestTVLPairWithOther) => {
          // 토큰이 한쌍에 존재하는 멀티 토큰(페어) 찾기
          const common = {
            type: TOKEN_TYPE.MULTI,
            tokenPrice: Not(IsNull()),
            status: true,
          };

          const composedTokenPairs =
            await this.tokenService.repository.findAllBy([
              {
                pair0: token,
                ...common,
              },
              {
                pair1: token,
                ...common,
              },
            ]);

          let bestTVLPair = null;
          let maxTVL = ZERO;

          // 최고 유동 풀 페어 및 다른 쌍 토큰 찾기
          composedTokenPairs.forEach((pair: Token) => {
            const {
              totalSupply,
              tokenPrice: { value },
            } = pair;

            if (
              !isNull(totalSupply) &&
              !isNull(value) &&
              isGreaterThan(totalSupply, ZERO) &&
              isGreaterThan(value, ZERO)
            ) {
              const tvl = mul(totalSupply, value);

              if (isGreaterThan(tvl, maxTVL)) {
                bestTVLPair = pair;
                maxTVL = tvl;
              }
            }
          });

          if (!isNull(bestTVLPair)) {
            token.bestTVLPair = bestTVLPair;
            token.other =
              bestTVLPair.pair0.id === token.id
                ? bestTVLPair.pair1
                : bestTVLPair.pair0;

            tokenZip.push(token);
          }
        }),
      );

      return tokenZip;
    } catch (e) {
      throw Error(e);
    }
  }

  /**
   * 가격 산출을 위한 필요 데이터 인코딩
   * @param tokenWithBestTVLPairWithOther  토큰과 가장 높은 TVL을 가진 페어
   * @returns 인코딩 데이터
   */
  getInfoDataEncoding(
    tokenWithBestTVLPairWithOther: ITokenExtendBestTVLPairWithOther[],
  ): any[][] {
    return tokenWithBestTVLPairWithOther.map(
      (token: ITokenExtendBestTVLPairWithOther) => {
        const { address, bestTVLPair, other } = token;

        return [
          // 가격 추적 대상 토큰이 페어에 존재하는 수량
          [
            address,
            encodeFunction(ERC20_ABI, 'balanceOf', [bestTVLPair.address]),
          ],
          // 가격 추적과 쌍이된 다른 토큰이 페어에 존재하는 수량
          [
            other.address,
            encodeFunction(ERC20_ABI, 'balanceOf', [bestTVLPair.address]),
          ],
        ];
      },
    );
  }

  /**
   * 가격 산출을 위한 필요 데이터 디코딩
   * @param batchCallMap 가격 산출을 위한 필요 데이터 요청 결과 묶음
   * @param params 관련 토큰 데시멀
   * @returns 디코딩 데이터
   */
  getInfoDataDecoding(
    batchCallMap: any[],
    extraData: {
      targetTokenDecimals: number;
      otherTokenDecimals: number;
    },
  ): {
    targetTokenBalanceInPair: BigNumberJs;
    otherTokenBalanceInPair: BigNumberJs;
  } {
    const [
      {
        success: targetTokenBalanceInPairSuccess,
        returnData: targetTokenBalanceInPairData,
      },
      {
        success: otherTokenBalanceInPairSuccess,
        returnData: otherTokenBalanceInPairData,
      },
    ] = batchCallMap;

    const targetTokenBalanceInPair = validResult(
      targetTokenBalanceInPairSuccess,
      targetTokenBalanceInPairData,
    )
      ? divideDecimals(
          decodeFunctionResultData(
            ERC20_ABI,
            'balanceOf',
            targetTokenBalanceInPairData,
          ),
          extraData.targetTokenDecimals,
        )
      : ZERO;

    const otherTokenBalanceInPair = validResult(
      otherTokenBalanceInPairSuccess,
      otherTokenBalanceInPairData,
    )
      ? divideDecimals(
          decodeFunctionResultData(
            ERC20_ABI,
            'balanceOf',
            otherTokenBalanceInPairData,
          ),
          extraData.otherTokenDecimals,
        )
      : ZERO;

    return { targetTokenBalanceInPair, otherTokenBalanceInPair };
  }

  async trackingPrice(data: {
    network: Network;
    tokens: Token[];
    today: string;
    maxHistoricalRecordDays: number;
  }): Promise<void> {
    try {
      const { network, tokens, today, maxHistoricalRecordDays } = data;

      const tokenWithBestTVLPairWithOther = await this.getTokenWithBestTVLPair(
        tokens,
      );

      const infoDataEncode = this.getInfoDataEncoding(
        tokenWithBestTVLPairWithOther,
      );

      const infoDataBatchCall = await getBatchStaticAggregator(
        this.networkService.provider(network.chainKey) as Provider,
        this.networkService.multiCallAddress(network.chainKey),
        flat(infoDataEncode),
      );

      const infoDataBatchCallMap = toSplitWithChunkSize(infoDataBatchCall, 2);
      const tokenWithInfoBatchCallZip = zip(
        tokenWithBestTVLPairWithOther,
        infoDataBatchCallMap,
      );

      for await (const [token, batchCallMap] of tokenWithInfoBatchCallZip) {
        let queryRunner: QueryRunner | null = null;

        try {
          const { decimals, other } = token;

          const { targetTokenBalanceInPair, otherTokenBalanceInPair } =
            this.getInfoDataDecoding(batchCallMap, {
              targetTokenDecimals: decimals,
              otherTokenDecimals: other.decimals,
            });

          if (
            isZero(targetTokenBalanceInPair) ||
            isZero(otherTokenBalanceInPair)
          )
            continue;

          const otherTokenValueInPair = mul(
            otherTokenBalanceInPair,
            other.priceUSD,
          );

          const targetTokenValueInPair = div(
            otherTokenValueInPair,
            targetTokenBalanceInPair,
          );

          const value = toFixed(targetTokenValueInPair);
          const historicalValue = {
            ...this.removePastMaxHistoricalDays(
              token?.tokenPrice?.historicalValue,
              maxHistoricalRecordDays,
            ),
            [today]: value,
          };

          queryRunner =
            await this.handlerService.transaction.startTransaction();

          await this.tokenService.updateTokenPrice(
            token,
            {
              value,
              historicalValue,
            },
            queryRunner.manager,
          );

          await this.handlerService.transaction.commitTransaction(queryRunner);
        } catch (e) {
          await this.handlerService.transaction.rollbackTransaction(
            queryRunner,
          );

          const wrappedError = this.handlerService.wrappedError(e);

          // 인터널 노말 에러 시
          if (wrappedError.level === EXCEPTION_LEVEL.NORMAL) {
            continue;
          }

          throw Error(e);
        } finally {
          await this.handlerService.transaction.releaseTransaction(queryRunner);
        }
      }
    } catch (e) {
      throw Error(e);
    }
  }
}
