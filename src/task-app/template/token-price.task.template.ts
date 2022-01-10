import { Injectable } from '@nestjs/common';
import { TOKEN_PRICE_ORACLE_TYPE } from '@seongeun/aggregator-base/lib/constant';
import { Network, Token } from '@seongeun/aggregator-base/lib/entity';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { toSplitWithChunkSize } from '@seongeun/aggregator-util/lib/array';
import { get } from '@seongeun/aggregator-util/lib/object';
import { getToday } from '@seongeun/aggregator-util/lib/time';
import { IsNull, Not } from 'typeorm';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { TaskBase } from '../../task.base';

@Injectable()
export abstract class TokenPriceTaskTemplate extends TaskBase {
  network: Network;

  constructor(
    public id: string,
    public chainId: string,
    public chainType: string,
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly networkService: NetworkService,
  ) {
    super(id, taskHandlerService);
  }

  async onModuleInit(): Promise<void> {
    // task base
    super.onModuleInit();

    this.network = await this.networkService.repository.findOneBy({
      chainId: this.chainId,
      chainType: this.chainType,
    });
  }

  loggingForm(): Record<string, any> {
    return {};
  }

  async getTargetTotalTokens() {
    return this.tokenService.repository.findAllBy({
      network: this.network,
      tokenPrice: {
        oracleType: TOKEN_PRICE_ORACLE_TYPE.CHAIN_LINK,
      },
    });
  }

  async getChunkSize(): Promise<number> {
    const task = await this.taskHandlerService.getTask(this.taskId);
    return parseInt(get(task.config, 'chunk'), 10) || 100;
  }

  process(data: {
    tokens: Token[];
    today: string;
  }): Promise<Record<string, any>> {
    try {
      const { tokens, today } = data;

      const tokenAddresses = [];
      const feedAddresses = [];
      tokens.forEach(({ address, tokenPrice: { oracleData } }) => {
        tokenAddresses.push(address);
        feedAddresses.push(oracleData.feed);
      });

      return;
    } catch (e) {}
  }

  async run(): Promise<Record<string, any>> {
    try {
      const [totalTokens, chunkSize, today] = await Promise.all([
        this.getTargetTotalTokens(),
        this.getChunkSize(),
        getToday(),
      ]);
      console.log(totalTokens.length);

      const chunkTokens: Token[][] = toSplitWithChunkSize(
        totalTokens,
        chunkSize,
      );

      for await (const tokens of chunkTokens) {
        await this.process({ tokens, today });
      }

      return;
    } catch (e) {}
  }
}
