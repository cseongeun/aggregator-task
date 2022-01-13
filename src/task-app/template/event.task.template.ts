import { Injectable } from '@nestjs/common';
import { TaskBase } from '../../task.base';
import { TaskHandlerService } from '../handler/task-handler.service';
import { INTERACTION_TYPE } from '@seongeun/aggregator-base/lib/constant';
import { TContractAbi } from '@seongeun/aggregator-base/lib/interface';
import { getEventStream } from '@seongeun/aggregator-util/lib/stream';
@Injectable()
export abstract class EventTaskTemplate extends TaskBase {
  constructor(
    public readonly id: string,
    public readonly taskHandlerService: TaskHandlerService,
    public readonly context: any,
  ) {
    super(id, taskHandlerService);
  }
  loggingForm(): Record<string, any> {
    return;
  }
  /**
   * Event 작업 대상 정보
   */
  abstract getTargetDetail(): {
    type: INTERACTION_TYPE;
    address: string;
    abi: TContractAbi;
  };

  /**
   *
   */
  async process(data): Promise<any> {
    return;
  }

  async afterReceive(data: any) {
    console.log(data);
  }

  async run(): Promise<any> {
    try {
      const { type, address, abi } = this.getTargetDetail();

      const { stream } = getEventStream(this.context.provider, address, abi);

      stream(this.afterReceive);
    } catch (e) {}
  }
}
