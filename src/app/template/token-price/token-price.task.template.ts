import { Injectable } from '@nestjs/common';
import {
  NETWORK_CHAIN_ID,
  NETWORK_CHAIN_TYPE,
} from '@seongeun/aggregator-base/lib/constant';
import { Network } from '@seongeun/aggregator-base/lib/entity';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { get } from '@seongeun/aggregator-util/lib/object';
import { getToday } from '@seongeun/aggregator-util/lib/time';
import { TaskBase } from '../../../task.base';
import { HandlerService } from '../../handler/handler.service';
import { TokenPriceBaseService } from './service/service.base';

@Injectable()
export abstract class TokenPriceTaskTemplate extends TaskBase {
  network: Network;

  constructor(
    public readonly id: string,
    public readonly chainType: NETWORK_CHAIN_TYPE,
    public readonly chainId: NETWORK_CHAIN_ID,
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly networkService: NetworkService,
  ) {
    super(id, handlerService);
  }

  loggingForm(): Record<string, any> {
    return {};
  }

  async onModuleInit(): Promise<void> {
    super.onModuleInit();

    this.network = await this.networkService.repository.findOneBy({
      chainType: this.chainType,
      chainId: this.chainId,
    });
  }

  /**
   * 분할 단위
   * @returns 단위
   */
  async getChunkSize(): Promise<number> {
    const task = await this.handlerService.getTask(this.taskId);
    return parseInt(get(task.config, 'chunk'), 10) || 100;
  }

  /**
   * 최대 과거 기록일 가져오기
   * @returns 최대 과거 기록일
   */
  async getMaxHistoricalRecordDays(): Promise<number> {
    const task = await this.handlerService.getTask(this.taskId);
    return parseInt(get(task.config, 'historicalRecordDays'), 10) || 31;
  }

  /**
   * 로그 라벨 및 토큰 가격 추적 서비스
   */
  abstract getTokenPriceServiceMapLogLabel(): {
    label: string;
    service: TokenPriceBaseService;
  }[];

  /**
   * 진행
   * @param data { service: 토큰 가격 추적 서비스, chunkSize: 청크 사이즈, maxHistoricalRecordDays: 최대 가격 기록일, today: 오늘 날짜 }
   * @returns 서비스 단위 로그
   */
  async process(data: {
    targetService: TokenPriceBaseService;
    chunkSize: number;
    maxHistoricalRecordDays: number;
    today: string;
  }): Promise<Record<string, any>> {
    const { targetService, chunkSize, maxHistoricalRecordDays, today } = data;

    const log = await targetService.run({
      network: this.network,
      chunkSize,
      maxHistoricalRecordDays,
      today,
    });

    return log;
  }

  /**
   * 메인
   * @returns 로그
   */
  async run(): Promise<Record<string, any>> {
    const log = this.loggingForm();

    try {
      const [chunkSize, maxHistoricalRecordDays, today] = await Promise.all([
        this.getChunkSize(),
        this.getMaxHistoricalRecordDays(),
        getToday(),
      ]);

      // 해당 네트워크 토큰의 가격을 추적하는 모든 서비스
      const servicesWithLabel = this.getTokenPriceServiceMapLogLabel();

      for await (const { label, service } of servicesWithLabel) {
        const result = await this.process({
          targetService: service,
          chunkSize,
          maxHistoricalRecordDays,
          today,
        });

        log[label] = result;
      }
      return log;
    } catch (e) {
      throw Error(e);
    }
  }
}
