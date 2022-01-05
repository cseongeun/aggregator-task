import { CronJob } from 'cron';
import { CronExpression } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { getElapsedTime } from '@seongeun/aggregator-util/lib/time';
import { TaskHandlerService } from './app/handler/task-handler.service';

@Injectable()
export abstract class TaskBase {
  // 작업 로깅 디테일 폼
  abstract loggingForm(): Record<string, any> | null;
  // 작업 내부 루프 중 개별 작업 실행 <개별 작업 성공 여부>
  abstract process(data: any): Promise<boolean>;
  // 작업 메인 실행 로직 (ex,Loop 생성)
  abstract run(): Promise<Record<string, any> | null>;

  // 작업 아이디
  private taskId: string;
  // 작업 초기 반복
  private initTaskJobCron = CronExpression.EVERY_5_SECONDS;
  // 작업 리스너 반복
  private initTaskListenerJobCron = CronExpression.EVERY_10_MINUTES;
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
    this.taskHandlerService.manager.addTask(
      this.taskId,
      this.taskJob,
      this.taskListenerJob,
    );
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

      this.taskHandlerService.handleSuccess(this.taskId, {
        result,
        elapsedTime,
      });
    } catch (e) {
      this.taskHandlerService.handleError(this.taskId, e);
    } finally {
      this.isTaskJobWorking = false;
    }
  }

  /**
   * 작업 리스너 시작 (크론 )
   */
  private async _runTaskListenerJob(): Promise<void> {
    return;
  }
}
