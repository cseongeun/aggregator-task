import { Injectable } from '@nestjs/common';
import { TASK_ID } from '../app.constant';
import { HandlerService } from '../app/handler/handler.service';
import { TaskBase } from '../task.base';
import { RedisService, REDIS_CACHE_KEY } from '@seongeun/aggregator-common';

@Injectable()
export class EventInteractionAllMigrationTask extends TaskBase {
  loggingForm(): Record<string, any> {
    throw new Error('Method not implemented.');
  }
  process(data: any): Promise<Record<string, any>> {
    throw new Error('Method not implemented.');
  }

  constructor(
    public readonly handlerService: HandlerService,
    public readonly redisService: RedisService,
  ) {
    super(TASK_ID.EVENT_INTERACTION_ALL_MIGRATION, handlerService);
  }

  async run(): Promise<Record<string, any>> {
    const result = await this.redisService.getData(
      REDIS_CACHE_KEY.EVENT_STORAGE,
    );
    console.log('here', JSON.parse(result));
    return {};
  }
}
