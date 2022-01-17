import { CronJob } from 'cron';
import { CronExpression } from '@nestjs/schedule';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { getElapsedTime } from '@seongeun/aggregator-util/lib/time';
import { TaskHandlerService } from './task-app/handler/task-handler.service';
import { Task } from '@seongeun/aggregator-base/lib/entity';

@Injectable()
export abstract class TaskBase implements OnModuleInit {
  // 작업 로깅 디테일 폼
  abstract loggingForm(): Record<string, any>;
  // 작업 메인 (단위 테스트를 위한 분리)
  abstract process(data: any): Promise<Record<string, any> | null>;
  // 작업 실행  (ex,Loop 생성)
  abstract run(): Promise<Record<string, any>>;

  // 작업 초기 반복
  private initTaskJobCron = CronExpression.EVERY_5_SECONDS;
  // 작업 리스너 반복
  private initTaskListenerJobCron = CronExpression.EVERY_5_SECONDS;
  // private initTaskListenerJobCron = CronExpression.EVERY_MINUTE;

  // 현재 작업 상태
  protected task: Task;
  // 작업 아이디
  protected taskId: string;
  // 작업
  protected taskJob: CronJob = null;
  // 작업 리스너
  protected taskListenerJob: CronJob = null;
  // 작업 진행 여부
  protected isTaskJobWorking = false;
  // 작업 리스너 진행 여부
  protected isTaskListenerJobWorking = false;

  constructor(
    public readonly id: string,
    public readonly taskHandlerService: TaskHandlerService,
  ) {
    // 작업 및 작업 리스너 아이디 등록
    this.taskId = id;

    // 작업 생성
    this.taskJob = new CronJob(this.initTaskJobCron, async () => {
      await this._runTaskJob();
    });

    // 작업 리스너 생성
    this.taskListenerJob = new CronJob(this.initTaskListenerJobCron, () => {
      this._runTaskListenerJob();
    });

    // 작업 및 작업 리스너 등록
    this.taskHandlerService.manager.addTaskJob(
      this.taskId,
      this.taskJob,
      this.taskListenerJob,
    );
  }

  async onModuleInit(): Promise<void> {
    // 시작 작업 상태 업데이트
    this.task = await this.taskHandlerService.getTask(this.taskId);
  }

  /**
   * 작업 시작
   */
  private async _runTaskJob(): Promise<void> {
    try {
      if (this.isTaskJobWorking) {
        return;
      }

      this.isTaskJobWorking = true;

      const startTime = new Date().getTime();

      const result = await this.run();

      const elapsedTime = `${getElapsedTime(startTime, 's')}s`;

      await this.taskHandlerService.handleSuccess(this.taskId, {
        result,
        elapsedTime,
      });

      this.isTaskJobWorking = false;
    } catch (e) {
      this.taskHandlerService.handleError(this.taskId, e);
    }
  }

  /**
   * 작업 리스너 시작
   */
  private async _runTaskListenerJob(): Promise<void> {
    try {
      if (this.isTaskListenerJobWorking) {
        return;
      }

      this.isTaskListenerJobWorking = true;

      this.task = await this.taskHandlerService.handleTaskListener(this.task);

      this.isTaskListenerJobWorking = false;
    } catch (e) {
      await this.taskHandlerService.handleListenerError(this.taskId, e);
    }
  }
}
