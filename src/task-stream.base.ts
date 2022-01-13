import { Injectable, OnModuleInit } from '@nestjs/common';
import { TaskStream } from '@seongeun/aggregator-base/lib/entity';
import { CronJob } from 'cron';

@Injectable()
export abstract class TaskStreamBase implements OnModuleInit {
  abstract afterReceiveData(data: any);
  abstract generateStream(): Promise<any>;

  // 스트림 작업 상태
  protected taskStream: TaskStream;
  // 스트림 작업 아이디
  protected taskStreamId: string;

  // 스트림 작업 리스너
  protected taskStreamListenerJob: CronJob = null;

  // 스트림 작업 진행 여부
  protected isTaskStreamWorking = false;
  // 스트림 작업 리스너 진행 여부
  protected isTaskStreamListenerWorking = false;

  constructor(public readonly id: string) {
    this.taskStreamId = id;
  }

  async onModuleInit(): Promise<void> {}
}
