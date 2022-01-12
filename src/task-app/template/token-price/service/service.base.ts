import { Injectable } from '@nestjs/common';
import { Network, Token } from '@seongeun/aggregator-base/lib/entity';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import {
  sortBy,
  toSplitWithChunkSize,
} from '@seongeun/aggregator-util/lib/array';
import { getBeforeSpecifiedDay } from '@seongeun/aggregator-util/lib/time';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import { TASK_EXCEPTION_LEVEL } from '../../../exception/task-exception.constant';
import { TaskHandlerService } from '../../../handler/task-handler.service';

@Injectable()
export abstract class TokenPriceBaseService {
  constructor(
    public readonly networkService: NetworkService,
    public readonly tokenService: TokenService,
    public readonly taskHandlerService: TaskHandlerService,
  ) {}

  abstract getTargetTotalTokens(network: Network): Promise<Token[]>;
  abstract trackingPrice(data: {
    network: Network;
    tokens: Token[];
    today: string;
    maxHistoricalRecordDays: number;
  }): Promise<void>;

  loggingForm(): { total: number; success: number; warn: number } {
    return {
      total: 0,
      success: 0,
      warn: 0,
    };
  }

  /**
   * 최대 기록 날짜가 지난 데이터 지우기
   * @param historicalValue 과거 가격 데이터
   * @param maxHistoricalRecordDays 최대로 기록하는 이전 날
   * @returns 지난 날을 제거한 과거 가격 데이터
   */
  removePastMaxHistoricalDays(
    historicalValue: Record<string, string>,
    maxHistoricalRecordDays: number,
  ) {
    if (isNull(historicalValue) || isUndefined(historicalValue)) {
      return historicalValue;
    }

    const recordMaxPastDay = getBeforeSpecifiedDay(maxHistoricalRecordDays);
    const recordedHistoricalDays = Object.keys(historicalValue);
    const sortedRecordedHistoricalDays = sortBy(recordedHistoricalDays);

    sortedRecordedHistoricalDays.forEach((recordDay) => {
      if (
        new Date(recordDay).getTime() < new Date(recordMaxPastDay).getTime()
      ) {
        delete historicalValue[recordDay];
      }
    });

    return historicalValue;
  }

  /**
   * 각 서비스 별 토큰을 청크 사이즈로 나눈뒤 토큰 가격 추적(trackingPrice()) 진행
   * @param data { network: 토큰 가격 추적하는 네트워크, chunkSize: 서비스가 추적하는 토큰을 청크사이즈만큼 분리, maxHistoricalRecordDays: 과거 최대 기록일, today: 오늘 날짜 }
   * @returns log
   */
  async run(data: {
    network: Network;
    chunkSize: number;
    maxHistoricalRecordDays: number;
    today: string;
  }): Promise<Record<string, any>> {
    const log = this.loggingForm();
    try {
      const { network, chunkSize, maxHistoricalRecordDays, today } = data;

      const totalTokens = await this.getTargetTotalTokens(network);

      log.total = totalTokens.length;

      const chunkTokens: Token[][] = toSplitWithChunkSize(
        totalTokens,
        chunkSize,
      );

      for await (const tokens of chunkTokens) {
        try {
          await this.trackingPrice({
            network,
            tokens,
            today,
            maxHistoricalRecordDays,
          });
          log.success += tokens.length;
        } catch (e) {
          const wrappedError = this.taskHandlerService.wrappedError(e);
          // 인터널 노말 에러 시
          if (wrappedError.level === TASK_EXCEPTION_LEVEL.NORMAL) {
            log.warn += tokens.length;

            continue;
          }
          throw Error(e);
        }
      }

      return log;
    } catch (e) {
      throw Error(e);
    }
  }
}
