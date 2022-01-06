import { Injectable } from '@nestjs/common';
import {
  FarmService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { BigNumber } from '@ethersproject/bignumber';
import { fillSequenceNumber, zip } from '@seongeun/aggregator-util/lib/array';
import { TaskHandlerService } from '../handler/task-handler.service';
import { TaskBase } from '../../task.base';
import { Token } from '@seongeun/aggregator-base/lib/entity';

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

  loggingForm(): Record<string, any> {
    return {
      total: 0,
      start: 0,
      end: 0,
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
   * 팜의 상태
   */
  abstract getFarmState(): Promise<Record<string, any>>;

  /**
   * 팜의 정보
   * @param sequence pids
   */
  abstract getFarmInfos(sequence: number[]): Promise<Record<string, any>[]>;

  /**
   * 팜 등록
   * @param farmInfo 팜 정보
   */
  abstract registerFarm(farmInfo: Record<string, any>): Promise<boolean>;

  /**
   * 팜 업데이트
   * @param farmInfo 팜 정보
   * @param farmState 팜 상태
   */
  abstract refreshFarm(
    farmInfo: Record<string, any>,
    farmState: Record<string, any>,
  ): Promise<void>;

  /**
   * 진행
   * @param data 관련 정보
   */
  abstract process(data: {
    pid;
    farmInfo;
    farmState;
  }): Promise<Record<string, any> | null>;

  async run(): Promise<Record<string, any>> {
    const log = this.loggingForm();

    try {
      const [networkPid, farmState] = await Promise.all([
        this.getNetworkPid(),
        this.getFarmState(),
      ]);

      const totalPids = fillSequenceNumber(networkPid.toNumber());
      const farmInfos = await this.getFarmInfos(totalPids);

      log.total = farmInfos.length;

      for await (const [pid, farmInfo] of zip(totalPids, farmInfos)) {
        const success = await this.process({ pid, farmInfo, farmState });

        if (success) {
          log.success += 1;
          continue;
        }

        log.warn += 1;
      }

      return log;
    } catch (e) {
      throw new Error(e);
    }
  }
}
