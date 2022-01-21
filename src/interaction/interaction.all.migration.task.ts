import { Injectable } from '@nestjs/common';
import { TASK_ID } from '../app.constant';
import { HandlerService } from '../app/handler/handler.service';
import { TaskBase } from '../task.base';
import { RedisService, REDIS_KEY } from '@seongeun/aggregator-common';
import { InteractionService } from '@seongeun/aggregator-base/lib/service';
import { isGreaterThan } from '@seongeun/aggregator-util/lib/bignumber';

@Injectable()
export class InteractionAllMigrationTask extends TaskBase {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly redisService: RedisService,
    public readonly interactionService: InteractionService,
  ) {
    super(TASK_ID.INTERACTION_ALL_MIGRATION, handlerService);
  }

  loggingForm(): Record<string, any> {
    return {
      event: 0,
      interaction: 0,
    };
  }

  async popTotalData(key: REDIS_KEY): Promise<string[]> {
    const len = await this.redisService.getListLen(key);

    if (!isGreaterThan(len, 0)) {
      return [];
    }

    return this.redisService.popListData(key, len);
  }

  async process(data: { interactionData }): Promise<Record<string, any>> {
    const { interactionData } = data;

    if (isGreaterThan(interactionData.length, 0)) {
      const result =
        await this.interactionService.repository.createAllIfNotExistBy(
          interactionData.map((data) => JSON.parse(data)),
        );

      return { insert: result?.raw?.affectedRows };
    }

    return { insert: 0 };
  }

  async run(): Promise<Record<string, any>> {
    try {
      const interactionData = await this.popTotalData(
        REDIS_KEY.INTERACTION_STORAGE,
      );

      const result = await this.process({ interactionData });

      return { interaction: result?.insert };
    } catch (e) {
      throw Error(e);
    }
  }
}
