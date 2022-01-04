import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { isNull } from '@seongeun/aggregator-util/lib/type';
import { CronJob } from 'cron';

@Injectable()
export class TaskManagerService {
  constructor(private readonly manager: SchedulerRegistry) {}

  /**
   * 작업 및 작업 리스너
   * @param id id
   * @returns taskJob, taskListenerJob
   */
  getTask(id: string): { taskJob: CronJob; taskListenerJob: CronJob } {
    let taskJob: CronJob = null;
    let taskListenerJob: CronJob = null;

    if (this.isRegisteredTask(id)) {
      taskJob = this.manager.getCronJob(id);
    }

    const listenerId = this._generateListenerId(id);
    if (this.isRegisteredTask(listenerId)) {
      taskListenerJob = this.manager.getCronJob(listenerId);
    }

    return { taskJob, taskListenerJob };
  }

  /**
   * 작업 등록
   * @param id 작업 아이디
   * @param task 작업
   * @param taskListener 작업 리스너
   */
  addTask(id: string, task: CronJob, taskListener: CronJob): void {
    this.manager.addCronJob(id, task);
    this.manager.addCronJob(this._generateListenerId(id), taskListener);
  }

  /**
   * 작업 삭제
   * @param id 작업 아이디
   */
  delTask(id: string): void {
    if (this.isRegisteredTask(id)) {
      this.manager.deleteCronJob(id);
    }

    const listenerId = this._generateListenerId(id);
    if (this.isRegisteredTask(listenerId)) {
      this.manager.deleteCronJob(listenerId);
    }
  }

  /**
   * 작업 등록 여부
   * @param id 작업 아이디
   * @returns 등록 여부
   */
  isRegisteredTask(id: string): boolean {
    return this.manager.doesExists('cron', id);
  }

  /**
   * 작업 및 작업 리스너 시작
   * @param id 작업 아이디
   */
  startAllTaskWithListener(id: string) {
    const { taskJob, taskListenerJob } = this.getTask(id);

    if (!isNull(taskJob)) taskJob.start();
    if (!isNull(taskListenerJob)) taskListenerJob.start();
  }

  /**
   * 작업 중단
   * @param id 작업 아이디
   */
  stopTask(id: string) {
    const { taskJob } = this.getTask(id);

    if (!isNull(taskJob)) taskJob.stop();
  }

  /**
   * 작업 리스너 아이디 생성
   * @param id 작업 아이디
   * @returns 작업 리스너 아이디
   */
  private _generateListenerId(id: string): string {
    return `${id}-LISTENER`;
  }
}
