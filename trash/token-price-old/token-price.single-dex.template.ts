// import { Injectable } from '@nestjs/common';
// import {
//   NETWORK_CHAIN_ID,
//   NETWORK_CHAIN_TYPE,
//   TOKEN_TYPE,
// } from '@seongeun/aggregator-base/lib/constant';
// import { Token } from '@seongeun/aggregator-base/lib/entity';
// import {
//   NetworkService,
//   TokenService,
// } from '@seongeun/aggregator-base/lib/service';
// import { getBatchStaticAggregator } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
// import { isNull } from '@seongeun/aggregator-util/lib/type';
// import { IsNull, Not, QueryRunner } from 'typeorm';
// import { TASK_EXCEPTION_LEVEL } from '../task-app/exception/task-exception.constant';
// import { TaskHandlerService } from '../task-app/handler/task-handler.service';
// import { Provider } from '@ethersproject/providers';
// import {
//   flat,
//   toSplitWithChunkSize,
//   zip,
// } from '@seongeun/aggregator-util/lib/array';
// import {
//   div,
//   isGreaterThan,
//   isZero,
//   mul,
//   toFixed,
// } from '@seongeun/aggregator-util/lib/bignumber';
// import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
// import { TokenPriceTaskTemplate } from './token-price.task.template';
// import { ZERO } from '@seongeun/aggregator-util/lib/constant';
// import {
//   decodeFunctionResultData,
//   encodeFunction,
//   validResult,
// } from '@seongeun/aggregator-util/lib/encodeDecode';
// import { ERC20_ABI } from '@seongeun/aggregator-util/lib/erc20';

// interface ITokenExtendBestTVLPairWithOther extends Token {
//   bestTVLPair: Token;
//   other: Token;
// }

// @Injectable()
// export abstract class TokenPriceSingleDexTaskTemplate {
//   constructor(
//     public readonly chainType: NETWORK_CHAIN_TYPE,
//     public readonly chainId: NETWORK_CHAIN_ID,
//     public readonly taskHandlerService: TaskHandlerService,
//     public readonly tokenService: TokenService,
//     public readonly networkService: NetworkService,
//   ) {}

//   /**
//    * 싱글 타입 네트워크 토큰 가져오기
//    * @returns 토큰
//    */
//   async getTargetTotalTokens() {
//     return this.tokenService.search({
//       networkId: this.network.id,
//       type: TOKEN_TYPE.SINGLE,
//       oracleType: null,
//     });
//   }

//   async getTokenWithBestTVLPair(
//     tokens: Token[],
//   ): Promise<ITokenExtendBestTVLPairWithOther[]> {
//     try {
//       const tokenZip: ITokenExtendBestTVLPairWithOther[] = [];

//       await Promise.all(
//         tokens.map(async (token: ITokenExtendBestTVLPairWithOther) => {
//           // 토큰이 한쌍에 존재하는 멀티 토큰(페어) 찾기
//           const common = {
//             type: TOKEN_TYPE.MULTI,
//             tokenPrice: Not(IsNull()),
//             status: true,
//           };

//           const composedTokenPairs =
//             await this.tokenService.repository.findAllBy([
//               {
//                 pair0: token,
//                 ...common,
//               },
//               {
//                 pair1: token,
//                 ...common,
//               },
//             ]);

//           let bestTVLPair = null;
//           let maxTVL = ZERO;

//           // 최고 유동 풀 페어 및 다른 쌍 토큰 찾기
//           composedTokenPairs.forEach((pair: Token) => {
//             const {
//               totalSupply,
//               tokenPrice: { value },
//             } = pair;

//             if (
//               !isNull(totalSupply) &&
//               !isNull(value) &&
//               isGreaterThan(totalSupply, ZERO) &&
//               isGreaterThan(value, ZERO)
//             ) {
//               const tvl = mul(totalSupply, value);

//               if (isGreaterThan(tvl, maxTVL)) {
//                 bestTVLPair = pair;
//                 maxTVL = tvl;
//               }
//             }
//           });

//           if (!isNull(bestTVLPair)) {
//             token.bestTVLPair = bestTVLPair;
//             token.other =
//               bestTVLPair.pair0.id === token.id
//                 ? bestTVLPair.pair1
//                 : bestTVLPair.pair0;

//             tokenZip.push(token);
//           }
//         }),
//       );

//       return tokenZip;
//     } catch (e) {
//       throw Error(e);
//     }
//   }

//   getInfoDataEncoding(
//     tokenWithBestTVLPairWithOther: ITokenExtendBestTVLPairWithOther[],
//   ): any[][] {
//     return tokenWithBestTVLPairWithOther.map(
//       (token: ITokenExtendBestTVLPairWithOther) => {
//         const { address, bestTVLPair, other } = token;

//         return [
//           // 가격 추적 대상 토큰이 페어에 존재하는 수량
//           [
//             address,
//             encodeFunction(ERC20_ABI, 'balanceOf', [bestTVLPair.address]),
//           ],
//           // 가격 추적과 쌍이된 다른 토큰이 페어에 존재하는 수량
//           [
//             other.address,
//             encodeFunction(ERC20_ABI, 'balanceOf', [bestTVLPair.address]),
//           ],
//         ];
//       },
//     );
//   }

//   getInfoDataDecoding(
//     batchCallMap: any[],
//     decimals: {
//       targetTokenDecimals: number;
//       otherTokenDecimals: number;
//     },
//   ) {
//     const [
//       {
//         success: targetTokenBalanceInPairSuccess,
//         returnData: targetTokenBalanceInPairData,
//       },
//       {
//         success: otherTokenBalanceInPairSuccess,
//         returnData: otherTokenBalanceInPairData,
//       },
//     ] = batchCallMap;

//     const targetTokenBalanceInPair = validResult(
//       targetTokenBalanceInPairSuccess,
//       targetTokenBalanceInPairData,
//     )
//       ? divideDecimals(
//           decodeFunctionResultData(
//             ERC20_ABI,
//             'balanceOf',
//             targetTokenBalanceInPairData,
//           ),
//           decimals.targetTokenDecimals,
//         )
//       : ZERO;

//     const otherTokenBalanceInPair = validResult(
//       otherTokenBalanceInPairSuccess,
//       otherTokenBalanceInPairData,
//     )
//       ? divideDecimals(
//           decodeFunctionResultData(
//             ERC20_ABI,
//             'balanceOf',
//             otherTokenBalanceInPairData,
//           ),
//           decimals.otherTokenDecimals,
//         )
//       : ZERO;

//     return { targetTokenBalanceInPair, otherTokenBalanceInPair };
//   }

//   /**
//    * 가격 수집 진행
//    * @param data { token: Token, maxHistoricalRecordDays: 최대 과거 기록일, today: 오늟 날짜 }
//    * @returns log
//    */
//   async process(data: {
//     tokens: Token[];
//     today: string;
//     maxHistoricalRecordDays: number;
//   }): Promise<any> {
//     try {
//       const { tokens, today, maxHistoricalRecordDays } = data;

//       const tokenWithBestTVLPairWithOther = await this.getTokenWithBestTVLPair(
//         tokens,
//       );

//       const infoDataEncode = this.getInfoDataEncoding(
//         tokenWithBestTVLPairWithOther,
//       );

//       const infoDataBatchCall = await this.retryWrap(
//         getBatchStaticAggregator(
//           this.networkService.provider(this.network.chainKey) as Provider,
//           this.networkService.multiCallAddress(this.network.chainKey),
//           flat(infoDataEncode),
//         ),
//       );

//       const infoDataBatchCallMap = toSplitWithChunkSize(infoDataBatchCall, 2);
//       const tokenWithInfoBatchCallZip = zip(
//         tokenWithBestTVLPairWithOther,
//         infoDataBatchCallMap,
//       );

//       for await (const [token, batchCallMap] of tokenWithInfoBatchCallZip) {
//         let queryRunner: QueryRunner | null = null;

//         try {
//           const { decimals, other } = token;

//           const { targetTokenBalanceInPair, otherTokenBalanceInPair } =
//             this.getInfoDataDecoding(batchCallMap, {
//               targetTokenDecimals: decimals,
//               otherTokenDecimals: other.decimals,
//             });

//           if (
//             isZero(targetTokenBalanceInPair) ||
//             isZero(otherTokenBalanceInPair)
//           )
//             continue;

//           const otherTokenValueInPair = mul(
//             otherTokenBalanceInPair,
//             other.priceUSD,
//           );

//           const targetTokenValueInPair = div(
//             otherTokenValueInPair,
//             targetTokenBalanceInPair,
//           );

//           const value = toFixed(targetTokenValueInPair);
//           const historicalValue = {
//             ...this.removePastMaxHistoricalDays(
//               token?.tokenPrice?.historicalValue,
//               maxHistoricalRecordDays,
//             ),
//             [today]: value,
//           };

//           queryRunner =
//             await this.taskHandlerService.transaction.startTransaction();

//           await this.tokenService.updateTokenPrice(
//             token,
//             {
//               value,
//               historicalValue,
//             },
//             queryRunner.manager,
//           );

//           await this.taskHandlerService.transaction.commitTransaction(
//             queryRunner,
//           );
//         } catch (e) {
//           await this.taskHandlerService.transaction.rollbackTransaction(
//             queryRunner,
//           );

//           const wrappedError = this.taskHandlerService.wrappedError(e);

//           // 인터널 노말 에러 시
//           if (wrappedError.level === TASK_EXCEPTION_LEVEL.NORMAL) {
//             continue;
//           }

//           throw Error(e);
//         } finally {
//           await this.taskHandlerService.transaction.releaseTransaction(
//             queryRunner,
//           );
//         }
//       }
//       return { success: true };
//     } catch (e) {
//       throw Error(e);
//     }
//   }
// }
