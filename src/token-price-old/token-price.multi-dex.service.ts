// import { Injectable } from '@nestjs/common';
// import {
//   NETWORK_CHAIN_ID,
//   NETWORK_CHAIN_TYPE,
//   TOKEN_PRICE_ORACLE_TYPE,
//   TOKEN_TYPE,
// } from '@seongeun/aggregator-base/lib/constant';
// import { Token } from '@seongeun/aggregator-base/lib/entity';
// import {
//   NetworkService,
//   TokenService,
// } from '@seongeun/aggregator-base/lib/service';
// import {
//   flat,
//   toSplitWithChunkSize,
//   zip,
// } from '@seongeun/aggregator-util/lib/array';
// import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
// import { TaskHandlerService } from '../task-app/handler/task-handler.service';
// import { TokenPriceTaskTemplate } from './token-price.task.template';
// import {
//   decodeFunctionResultData,
//   encodeFunction,
//   validResult,
// } from '@seongeun/aggregator-util/lib/encodeDecode';
// import { ERC20_ABI } from '@seongeun/aggregator-util/lib/erc20';
// import { getBatchStaticAggregator } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
// import { Provider } from '@ethersproject/providers';
// import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
// import { ZERO } from '@seongeun/aggregator-util/lib/constant';
// import {
//   div,
//   isZero,
//   mul,
//   toFixed,
// } from '@seongeun/aggregator-util/lib/bignumber';
// import { QueryRunner } from 'typeorm';
// import { TASK_EXCEPTION_LEVEL } from '../task-app/exception/task-exception.constant';

// interface ITokenExtendBestPair extends Token {
//   bestPair: Token;
// }
// @Injectable()
// export abstract class TokenPriceMultiDexServiceTask extends TokenPriceTaskTemplate {
//   constructor(
//     public readonly id: string,
//     public readonly chainType: NETWORK_CHAIN_TYPE,
//     public readonly chainId: NETWORK_CHAIN_ID,
//     public readonly taskHandlerService: TaskHandlerService,
//     public readonly tokenService: TokenService,
//     public readonly networkService: NetworkService,
//   ) {
//     super(
//       id,
//       chainType,
//       chainId,
//       taskHandlerService,
//       tokenService,
//       networkService,
//     );
//   }

//   /**
//    * 멀티 타입 네트워크 토큰 가져오기
//    * @returns 토큰
//    */
//   async getTargetTotalTokens() {
//     return this.tokenService.search({
//       networkId: this.network.id,
//       type: TOKEN_TYPE.MULTI,
//     });
//   }

//   /**
//    * 인증받은 페어 고르기(체인링크를 통해 가격정보를 받아오는 토큰)
//    * @param token verified oracle pair
//    */
//   getTokenWithBestPair(tokens: Token[]): ITokenExtendBestPair[] {
//     try {
//       const tokenZip: ITokenExtendBestPair[] = [];

//       tokens.map((token: ITokenExtendBestPair) => {
//         const { pair0, pair1 } = token;

//         if (!isNull(pair0) || !isUndefined(pair0))
//           if (!isNull(pair0.tokenPrice)) {
//             const {
//               tokenPrice: { oracleType: pair0OracleType, value: pair0Value },
//             } = pair0;

//             if (
//               pair0OracleType === TOKEN_PRICE_ORACLE_TYPE.CHAIN_LINK &&
//               !isNull(pair0Value)
//             ) {
//               token.bestPair = pair0;
//               tokenZip.push(token);
//               return;
//             }
//           }

//         if (!isNull(pair1) || !isUndefined(pair1)) {
//           if (!isNull(pair1.tokenPrice)) {
//             const {
//               tokenPrice: { oracleType: pair1OracleType, value: pair1Value },
//             } = pair1;

//             if (
//               pair1OracleType === TOKEN_PRICE_ORACLE_TYPE.CHAIN_LINK &&
//               !isNull(pair1Value)
//             ) {
//               token.bestPair = pair1;
//               tokenZip.push(token);
//               return;
//             }
//           }
//         }
//       });

//       return tokenZip;
//     } catch (e) {
//       throw Error(e);
//     }
//   }

//   getInfoDataEncoding(tokenWithBestPair: ITokenExtendBestPair[]): any[][] {
//     return tokenWithBestPair.map((token: ITokenExtendBestPair) => {
//       const { address, bestPair } = token;

//       return [
//         [address, encodeFunction(ERC20_ABI, 'totalSupply')],
//         [bestPair.address, encodeFunction(ERC20_ABI, 'balanceOf', [address])],
//       ];
//     });
//   }

//   async process(data: {
//     tokens: Token[];
//     today: string;
//     maxHistoricalRecordDays: number;
//   }): Promise<Record<string, any>> {
//     try {
//       const { tokens, today, maxHistoricalRecordDays } = data;

//       const tokenWithBestPairZip = this.getTokenWithBestPair(tokens);

//       const infoDataEncode = this.getInfoDataEncoding(tokenWithBestPairZip);

//       const infoDataBatchCall = await this.retryWrap(
//         getBatchStaticAggregator(
//           this.networkService.provider(this.network.chainKey) as Provider,
//           this.networkService.multiCallAddress(this.network.chainKey),
//           flat(infoDataEncode),
//         ),
//       );

//       const infoDataBatchCallMap = toSplitWithChunkSize(infoDataBatchCall, 2);
//       const tokenWithInfoBatchCallZip = zip(
//         tokenWithBestPairZip,
//         infoDataBatchCallMap,
//       );

//       for await (const [token, batchCallMap] of tokenWithInfoBatchCallZip) {
//         let queryRunner: QueryRunner | null = null;

//         try {
//           const { decimals, bestPair } = token;
//           const {
//             decimals: bestPairDecimals,
//             tokenPrice: { value: bestPairValue },
//           } = bestPair;

//           const [
//             {
//               success: multiTokenTotalSupplySuccess,
//               returnData: multiTokenTotalSupplyData,
//             },
//             {
//               success: bestPairTokenBalanceSuccess,
//               returnData: bestPairTokenBalanceData,
//             },
//           ] = batchCallMap;

//           const multiTokenSupply = validResult(
//             multiTokenTotalSupplySuccess,
//             multiTokenTotalSupplyData,
//           )
//             ? divideDecimals(
//                 decodeFunctionResultData(
//                   ERC20_ABI,
//                   'totalSupply',
//                   multiTokenTotalSupplyData,
//                 ),
//                 decimals,
//               )
//             : ZERO;

//           const bestPairBalance = validResult(
//             bestPairTokenBalanceSuccess,
//             bestPairTokenBalanceData,
//           )
//             ? divideDecimals(
//                 decodeFunctionResultData(
//                   ERC20_ABI,
//                   'balanceOf',
//                   bestPairTokenBalanceData,
//                 ),
//                 bestPairDecimals,
//               )
//             : ZERO;

//           const bestPairTotalValue = mul(bestPairBalance, bestPairValue);
//           const multiTokenTotalValue = mul(bestPairTotalValue, 2);

//           const multiTokenValue = isZero(multiTokenSupply)
//             ? ZERO
//             : div(multiTokenTotalValue, multiTokenSupply);

//           const value = toFixed(multiTokenValue);

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
