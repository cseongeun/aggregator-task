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
// import { getBatchChainLinkData } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
// import { get } from '@seongeun/aggregator-util/lib/object';
// import { isUndefined } from '@seongeun/aggregator-util/lib/type';
// import { QueryRunner } from 'typeorm';
// import { TASK_EXCEPTION_CODE } from '../task-app/exception/task-exception.constant';
// import { TaskHandlerService } from '../task-app/handler/task-handler.service';
// import { Provider } from '@ethersproject/providers';
// import { zip } from '@seongeun/aggregator-util/lib/array';
// import { isZero, toFixed } from '@seongeun/aggregator-util/lib/bignumber';
// import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';

// import { TokenPriceTaskTemplate } from './token-price.task.template';

// @Injectable()
// export abstract class TokenPriceChainLinkOracleTaskTemplate extends TokenPriceTaskTemplate {
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
//    * 체인링크 오라클을 사용하여 가격 정보를 가져오는 네트워크 토큰 가져오기
//    * @returns 토큰
//    */
//   async getTargetTotalTokens() {
//     return this.tokenService.search({
//       networkId: this.network.id,
//       type: [TOKEN_TYPE.NATIVE, TOKEN_TYPE.SINGLE],
//       oracleType: TOKEN_PRICE_ORACLE_TYPE.CHAIN_LINK,
//     });
//   }

//   /**
//    * 체인링크 가격 정보 가져오기
//    * @param tokens 토큰
//    * @returns 체인링크 가격 정보
//    */
//   async getChainLinkData(tokens: Token[]): Promise<any> {
//     const feedAddresses = tokens.map(({ tokenPrice: { oracleData } }) => {
//       const feed = get(oracleData, 'feed');

//       // console.log(tokenPrice);
//       if (isUndefined(feed)) {
//         throw Error(TASK_EXCEPTION_CODE.ERR2000);
//       }

//       return feed;
//     });

//     const chainLinkBatchCall = await this.retryWrap(
//       getBatchChainLinkData(
//         this.networkService.provider(this.network.chainKey) as Provider,
//         this.networkService.multiCallAddress(this.network.chainKey),
//         feedAddresses,
//       ),
//     );

//     return chainLinkBatchCall;
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
//   }): Promise<Record<string, any>> {
//     try {
//       const { tokens, today, maxHistoricalRecordDays } = data;

//       const chainLinkBatchCall = await this.getChainLinkData(tokens);

//       const tokenWithChainLink = zip(tokens, chainLinkBatchCall);

//       for await (const [token, chainLinkData] of tokenWithChainLink) {
//         let queryRunner: QueryRunner | null = null;

//         try {
//           const { answer, decimals: chainLinkPriceDecimals } = chainLinkData;

//           if (isZero(answer) || isZero(chainLinkPriceDecimals)) continue;

//           const value = toFixed(divideDecimals(answer, chainLinkPriceDecimals));

//           const historicalValue = {
//             ...this.removePastMaxHistoricalDays(
//               token.tokenPrice.historicalValue,
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
