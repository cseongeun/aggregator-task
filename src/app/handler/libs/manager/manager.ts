import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { isNull } from '@seongeun/aggregator-util/lib/type';
import { CronJob, CronTime } from 'cron';

@Injectable()
export class Manager {
  constructor(private readonly manager: SchedulerRegistry) {}

  /**
   * 작업 및 작업 리스너 조회
   * @param id id
   * @returns taskJob, taskListenerJob
   */
  getTaskJob(id: string): { taskJob: CronJob; taskListenerJob: CronJob } {
    let taskJob: CronJob = null;
    let taskListenerJob: CronJob = null;

    if (this.isRegisteredTaskJob(id)) {
      taskJob = this.manager.getCronJob(id);
    }

    const listenerId = this._generateListenerId(id);
    if (this.isRegisteredTaskJob(listenerId)) {
      taskListenerJob = this.manager.getCronJob(listenerId);
    }

    return { taskJob, taskListenerJob };
  }

  /**
   * 작업 및 작업 리스너 등록
   * @param id 작업 아이디
   * @param task 작업
   * @param taskListener 작업 리스너
   */
  addTaskJob(id: string, task: CronJob, taskListener?: CronJob): void {
    this.manager.addCronJob(id, task);

    if (taskListener) {
      this.manager.addCronJob(this._generateListenerId(id), taskListener);
    }
  }

  /**
   * 작업 및 작업 리스너 삭제
   * @param id 작업 아이디
   */
  delTaskJob(id: string): void {
    if (this.isRegisteredTaskJob(id)) {
      this.manager.deleteCronJob(id);
    }

    const listenerId = this._generateListenerId(id);
    if (this.isRegisteredTaskJob(listenerId)) {
      this.manager.deleteCronJob(listenerId);
    }
  }

  /**
   * 작업 등록 여부
   * @param id 작업 아이디
   * @returns 등록 여부
   */
  isRegisteredTaskJob(id: string): boolean {
    return this.manager.doesExists('cron', id);
  }

  /**
   * 작업
   * @param id 작업 아이디
   */
  startTaskJob(id: string): void {
    const { taskJob } = this.getTaskJob(id);

    if (!isNull(taskJob)) taskJob.start();
  }

  /**
   * 작업 리스너 시작
   * @param id 작업 아이디
   */
  startTaskListenerJob(id: string): void {
    const { taskListenerJob } = this.getTaskJob(id);

    if (!isNull(taskListenerJob)) taskListenerJob.start();
  }

  /**
   * 작업 중단
   * @param id 작업 아이디
   */
  stopTaskJob(id: string): void {
    const { taskJob } = this.getTaskJob(id);

    if (!isNull(taskJob)) taskJob.stop();
  }

  /**
   * 작업 크론 변경
   * @param id 작업 아이디
   * @param newCron 변경 크론
   */
  updateTaskJobCron(id: string, newCron: string): void {
    const { taskJob } = this.getTaskJob(id);
    taskJob.setTime(new CronTime(newCron));
    taskJob.start();
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
