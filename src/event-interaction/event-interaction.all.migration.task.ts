import { Injectable } from '@nestjs/common';
import { TASK_ID } from '../app.constant';
import { HandlerService } from '../app/handler/handler.service';
import { TaskBase } from '../task.base';
import { RedisService, REDIS_KEY } from '@seongeun/aggregator-common';
import {
  EventService,
  InteractionService,
} from '@seongeun/aggregator-base/lib/service';
import { isGreaterThan } from '@seongeun/aggregator-util/lib/bignumber';

@Injectable()
export class EventInteractionAllMigrationTask extends TaskBase {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly redisService: RedisService,
    public readonly eventService: EventService,
    public readonly interactionService: InteractionService,
  ) {
    super(TASK_ID.EVENT_INTERACTION_ALL_MIGRATION, handlerService);
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

  async process(data: {
    eventData;
    interactionData;
  }): Promise<Record<string, any>> {
    const { eventData, interactionData } = data;

    if (isGreaterThan(eventData.length, 0)) {
      await this.eventService.repository.createAllIfNotExistBy(
        eventData.map((data) => JSON.parse(data)),
      );
    }

    if (isGreaterThan(interactionData.length, 0)) {
      await this.interactionService.repository.createAllIfNotExistBy(
        interactionData.map((data) => JSON.parse(data)),
      );
    }

    return {};
  }

  async run(): Promise<Record<string, any>> {
    try {
      const [eventData, interactionData] = await Promise.all([
        this.popTotalData(REDIS_KEY.EVENT_STORAGE),
        this.popTotalData(REDIS_KEY.INTERACTION_STORAGE),
      ]);

      await this.process({ eventData, interactionData });

      return { event: eventData.length, interaction: interactionData.length };
    } catch (e) {
      throw Error(e);
    }
  }
}
