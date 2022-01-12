// import { Injectable } from '@nestjs/common';
// import {
//   NETWORK_CHAIN_ID,
//   NETWORK_CHAIN_TYPE,
// } from '@seongeun/aggregator-base/lib/constant';
// import { Network, Token } from '@seongeun/aggregator-base/lib/entity';
// import {
//   NetworkService,
//   TokenService,
// } from '@seongeun/aggregator-base/lib/service';
// import {
//   sortBy,
//   toSplitWithChunkSize,
// } from '@seongeun/aggregator-util/lib/array';
// import { get } from '@seongeun/aggregator-util/lib/object';
// import {
//   getBeforeSpecifiedDay,
//   getToday,
// } from '@seongeun/aggregator-util/lib/time';
// import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
// import { TaskBase } from '../task.base';
// import { TaskHandlerService } from '../task-app/handler/task-handler.service';
// import { TASK_EXCEPTION_LEVEL } from '../task-app/exception/task-exception.constant';

// @Injectable()
// export abstract class TokenPriceTaskTemplate extends TaskBase {
//   network: Network;

//   // 관련 토큰 가져오기
//   abstract getTargetTotalTokens(): Promise<Token[]>;
//   abstract process(data: {
//     tokens: Token[];
//     today: string;
//     maxHistoricalRecordDays: number;
//   }): Promise<Record<string, any>>;

//   constructor(
//     public readonly id: string,
//     public readonly chainType: NETWORK_CHAIN_TYPE,
//     public readonly chainId: NETWORK_CHAIN_ID,
//     public readonly taskHandlerService: TaskHandlerService,
//     public readonly tokenService: TokenService,
//     public readonly networkService: NetworkService,
//   ) {
//     super(id, taskHandlerService);
//   }

//   async onModuleInit(): Promise<void> {
//     super.onModuleInit();

//     this.network = await this.networkService.repository.findOneBy({
//       chainType: this.chainType,
//       chainId: this.chainId,
//     });
//   }

//   loggingForm(): Record<string, any> {
//     return {
//       total: 0,
//     };
//   }

//   /**
//    * 분할 단위
//    * @returns 단위
//    */
//   async getChunkSize(): Promise<number> {
//     const task = await this.taskHandlerService.getTask(this.taskId);
//     return parseInt(get(task.config, 'chunk'), 10) || 100;
//   }

//   /**
//    * 최대 과거 기록일 가져오기
//    * @returns 최대 과거 기록일
//    */
//   async getMaxHistoricalRecordDays(): Promise<number> {
//     const task = await this.taskHandlerService.getTask(this.taskId);
//     return parseInt(get(task.config, 'historicalRecordDays'), 10) || 31;
//   }

//   /**
//    * 최대 기록 날짜가 지난 데이터 지우기
//    * @param historicalValue 과거 가격 데이터
//    * @param maxHistoricalRecordDays 최대로 기록하는 이전 날
//    * @returns 지난 날을 제거한 과거 가격 데이터
//    */
//   removePastMaxHistoricalDays(
//     historicalValue: Record<string, string>,
//     maxHistoricalRecordDays: number,
//   ) {
//     if (isNull(historicalValue) || isUndefined(historicalValue)) {
//       return historicalValue;
//     }

//     const recordMaxPastDay = getBeforeSpecifiedDay(maxHistoricalRecordDays);
//     const recordedHistoricalDays = Object.keys(historicalValue);
//     const sortedRecordedHistoricalDays = sortBy(recordedHistoricalDays);

//     sortedRecordedHistoricalDays.forEach((recordDay) => {
//       if (
//         new Date(recordDay).getTime() < new Date(recordMaxPastDay).getTime()
//       ) {
//         delete historicalValue[recordDay];
//       }
//     });

//     return historicalValue;
//   }

//   async run(): Promise<Record<string, any>> {
//     const log = this.loggingForm();
//     try {
//       const [totalTokens, chunkSize, maxHistoricalRecordDays, today] =
//         await Promise.all([
//           this.getTargetTotalTokens(),
//           this.getChunkSize(),
//           this.getMaxHistoricalRecordDays(),
//           getToday(),
//         ]);

//       log.total = totalTokens.length;

//       const chunkTokens: Token[][] = toSplitWithChunkSize(
//         totalTokens,
//         chunkSize,
//       );

//       for await (const tokens of chunkTokens) {
//         try {
//           await this.process({
//             tokens,
//             maxHistoricalRecordDays,
//             today,
//           });
//         } catch (e) {
//           const wrappedError = this.taskHandlerService.wrappedError(e);

//           // 인터널 노말 에러 시
//           if (wrappedError.level === TASK_EXCEPTION_LEVEL.NORMAL) {
//             continue;
//           }
//           throw Error(e);
//         }
//       }

//       return log;
//     } catch (e) {
//       throw Error(e);
//     }
//   }
// }