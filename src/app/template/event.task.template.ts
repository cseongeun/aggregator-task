import { Injectable } from '@nestjs/common';
import { TaskBase } from '../../task.base';
import { HandlerService } from '../handler/handler.service';
import { INTERACTION_TYPE } from '@seongeun/aggregator-base/lib/constant';
import { TContractAbi } from '@seongeun/aggregator-base/lib/interface';
import * as _ from 'lodash';
import { ethers } from 'ethers';
import { Provider } from '@ethersproject/providers';

/**
 * 컨트랙트 이벤트 리시버
 * @param provider provider
 * @param address 컨트랙트 주소
 * @param abi 컨트랙트 ABI
 * @returns { stream: 이벤트 스트림 }
 */
export function getEventStream(
  provider: Provider,
  address: string,
  abi: any,
): { stream } {
  const contract = new ethers.Contract(address, abi, provider);
  const events = abi.filter((props) => props.type === 'event');
  const iface = new ethers.utils.Interface(events);
  const abiArgs = new Map<string, string[]>();

  events.forEach((props) => {
    abiArgs.set(
      props.name,
      props?.inputs?.map((params) => params.name),
    );
  });

  const stream = (callback: any) => {
    contract.on('*', (event) => {
      try {
        const { address, transactionHash, blockNumber } = event;
        const { name: eventName, args: eventArgs } = iface.parseLog(event);
        const args = this.abiArgs.get(eventName);

        const parseArgs = args.map((arg) => eventArgs[arg].toString());
        const mapArgs = _.zipObject(args, parseArgs);

        const data = {
          address,
          transactionHash,
          blockNumber,
          name: eventName,
          args: mapArgs,
        };
        console.log(data);
        callback(data);
      } catch (e) {}
    });
  };

  return { stream };
}

@Injectable()
export abstract class EventTaskTemplate extends TaskBase {
  constructor(
    public readonly id: string,
    public readonly handlerService: HandlerService,
    public readonly context: any,
  ) {
    super(id, handlerService);
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

      await stream(this.afterReceive);
    } catch (e) {
      console.log(e);
    }
  }
}
