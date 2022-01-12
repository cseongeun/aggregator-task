import { Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';
import { EntityManager } from 'typeorm';
import { Token } from '@seongeun/aggregator-base/lib/entity';
import {
  FarmService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { fillSequenceNumber, zip } from '@seongeun/aggregator-util/lib/array';
import { TaskHandlerService } from '../handler/task-handler.service';
import { TaskBase } from '../../task.base';
import { get } from '@seongeun/aggregator-util/lib/object';

@Injectable()
export abstract class FarmTaskTemplate extends TaskBase {
  constructor(
    public id: string,
    public readonly taskHandlerService: TaskHandlerService,
    public readonly farmService: FarmService,
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
   * 팜의 리워드 토큰
   */
  abstract getRewardToken(): Token;

  /**
   * 팜의 디테일 정보
   */
  abstract getFarmDetail(): { name: string; address: string };

  /**
   * 팜의 총 갯수
   */
  abstract getNetworkPid(): Promise<BigNumber>;

  /**
   * 팜의 정보
   * @param sequence pids
   */
  abstract getFarmInfos(sequence: number[]): Promise<Record<string, any>[]>;

  /**
   * 팜 글로벌 상태
   */
  abstract getGlobalFarmState(): Promise<Record<string, any>>;

  /**
   * 팜 지역 상태
   */
  abstract getLocalFarmState(
    farmInfo: Record<string, any>,
  ): Promise<Record<string, any>>;

  /**
   * 팜 등록
   * @param farmInfo 팜 정보
   * @param manager 트랜잭션 매니저
   */
  abstract registerFarm(
    farmInfo: Record<string, any>,
    manager?: EntityManager,
  ): Promise<boolean>;

  /**
   * 팜 업데이트
   * @param farmInfo 팜 정보
   * @param farmState 팜 상태
   * @param manager 트랜잭션 매니저
   */
  abstract refreshFarm(
    farmInfo: Record<string, any>,
    farmState: Record<string, any>,
    manager?: EntityManager,
  ): Promise<void>;

  /**
   * 진행
   * @param data 관련 정보
   */
  abstract process(data: {
    pid: number;
    farmInfo: Record<string, any>;
    globalState: Record<string, any>;
  }): Promise<Record<string, any> | null>;

  /**
   * 청크 사이즈
   * @returns 청크 사이즈
   */
  async getChunkSize(): Promise<number> {
    const task = await this.taskHandlerService.getTask(this.taskId);
    return parseInt(get(task.config, 'chunk'), 10) || 30;
  }

  /**
   * 메인
   * @returns 로그 
   */
  async run(): Promise<Record<string, any>> {
    const log = this.loggingForm();

    try {
      const [networkPid, globalState] = await Promise.all([
        this.getNetworkPid(),
        this.getGlobalFarmState(),
        this.getChunkSize(),
      ]);

      const totalPids = fillSequenceNumber(networkPid.toNumber());

      // const totalChunkPids = await toSplitWithChunkSize(totalPids, chunkSize);

      // const farmInfos = [];

      // for await (const chunkPids of totalChunkPids) {
      //   const chunkFarmInfos = await this.getFarmInfos(chunkPids);
      //   farmInfos.concat(chunkFarmInfos);
      // }

      const farmInfos = await this.getFarmInfos(totalPids);

      log.total = farmInfos.length;

      for await (const [pid, farmInfo] of zip(totalPids, farmInfos)) {
        const { success } = await this.process({
          pid,
          farmInfo,
          globalState,
        });

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
