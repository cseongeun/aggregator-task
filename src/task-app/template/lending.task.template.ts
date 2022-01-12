import { Injectable } from '@nestjs/common';
import {
  LendingService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { EntityManager } from 'typeorm';
import { TaskBase } from '../../task.base';
import { TaskHandlerService } from '../handler/task-handler.service';

@Injectable()
export abstract class LendingTaskTemplate extends TaskBase {
  constructor(
    public readonly id: string,
    public readonly taskHandlerService: TaskHandlerService,
    public readonly lendingService: LendingService,
    public readonly tokenService: TokenService,
    public readonly context,
  ) {
    super(id, taskHandlerService);
  }

  /**
   * 로깅 폼
   * @returns 로깅 폼 객체
   */
  loggingForm(): Record<string, any> {
    return {
      total: 0,
      success: 0,
      warn: 0,
    };
  }

  /**
   * 렌딩 등록
   * @param lendingInfo 렌딩 정보
   * @param manager 트랜잭션 매니저
   */
  abstract registerLending(
    lendingInfo: Record<string, any>,
    manager?: EntityManager,
  ): Promise<boolean>;

  /**
   * 렌딩 업데이트
   * @param lendingInfo 렌딩 정보
   * @param manager 트랜잭션 매니저
   */
  abstract refreshLending(
    lendingInfo: Record<string, any>,
    manager?: EntityManager,
  ): Promise<void>;

  /**
   * 추적될 렌딩 정보 모음
   */
  abstract getLendingInfos(): Promise<any>;

  /**
   * 진행
   * @param data 리프레쉬 진행될 렌딩 정보
   */
  abstract process(data: { lendingInfo }): Promise<Record<string, any>>;

  /**
   * 메인
   */
  async run(): Promise<Record<string, any>> {
    const log = this.loggingForm();

    try {
      const lendingInfos = await this.getLendingInfos();

      log.total = lendingInfos.length;

      for await (const lendingInfo of lendingInfos) {
        const { success } = await this.process({ lendingInfo });

        if (success) {
          log.success += 1;
          continue;
        }
        log.warn += 1;
      }

      return log;
    } catch (e) {
      throw Error(e);
    }
  }
}
