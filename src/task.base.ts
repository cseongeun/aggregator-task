import { CronJob } from 'cron';
import { Task } from '@seongeun/aggregator-base/lib/entity';
import { TaskService } from '@seongeun/aggregator-base/lib/service';
import { isCronString } from '@seongeun/aggregator-util/lib/type';
import { WinstonLoggerService } from '@seongeun/aggregator-logger/lib/winston-logger/winston-logger.service';
import { CronExpression } from '@nestjs/schedule';
import { TaskManagerService } from './task-app/manager/task-manager.service';
import { Injectable } from '@nestjs/common';
import { TaskLoggerService } from './task-app/logger/task-logger.service';
import { getElapsedTime } from '@seongeun/aggregator-util/lib/time';
import {
  EXCEPTION_CODE,
  EXCEPTION_LEVEL,
} from './task-app/exception/exception.constant';
import { Exception } from './task-app/exception/exception.dto';
import { TASK_MESSAGE } from './task-app/message/message.constant';

@Injectable()
export abstract class TaskBase {
  abstract run(): Promise<Record<string, any> | null>;

  // 작업 아이디
  private taskId: string;
  // 작업 초기 반복
  private initTaskJobCron = CronExpression.EVERY_SECOND;
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
  // 작업 패닉 상태
  protected isPanic = false;

  constructor(
    public readonly id: string,
    public readonly taskService: TaskService,
    public readonly taskManagerService: TaskManagerService,
    public readonly taskLoggerService: TaskLoggerService,
  ) {
    // 작업 및 작업 리스너 아이디 등록
    this.taskId = id;

    // 로깅 아이디 등록
    this.taskLoggerService.injectId(this.taskId);

    // 작업 생성
    this.taskJob = new CronJob(this.initTaskJobCron, () => {
      const doProcess = this._checkTaskJob();
      if (doProcess) {
        this._handleTaskJob();
      }
    });

    // 작업 리스너 생성
    this.taskListenerJob = new CronJob(this.initTaskListenerJobCron, () => {
      this._handleTaskListenerJob();
    });

    // 작업 및 작업 리스너 등록
    this.taskManagerService.addTask(
      this.taskId,
      this.taskJob,
      this.taskListenerJob,
    );
  }

  /**
   * 작업 시작 전 상태 체크 및 업데이트
   */
  private _checkTaskJob(): boolean {
    if (this.isTaskJobWorking) {
      return false;
    }

    // 작업 진행 중
    this.isTaskJobWorking = true;

    if (this.isPanic) {
      return false;
    }

    // TODO: Check List (cron)
  }

  /**
   * 작업 핸들링
   */
  private async _handleTaskJob(): Promise<void> {
    try {
      const startTime = new Date().getTime();

      const result = await this.run();

      const elapsedTime = `${getElapsedTime(startTime, 's')}s`;

      this._handleSuccess(result, elapsedTime);
    } catch (e) {
      let targetError: Exception;

      if (e instanceof Exception) {
        targetError = e;
      } else {
        targetError = this._errorFormat(e);
      }

      // 에러 레벨 분기
      if (targetError.level === EXCEPTION_LEVEL.NORMAL) {
        this._handleNormalError(targetError);
      } else {
        this._handlePanicError(targetError);
      }
    } finally {
      // 작업 미진행 중
      this.isTaskJobWorking = false;
    }
  }

  /**
   * 작업 리스너 핸들링
   */
  private async _handleTaskListenerJob(): Promise<void> {
    return;
  }

  // 성공 상황 핸들링
  private async _handleSuccess(
    result: Record<string, any> | null,
    elapsedTime: string,
  ): Promise<void> {
    this.taskLoggerService.log({
      message: TASK_MESSAGE.SUCCESS,
      work: result,
      elapsedTime,
    });
  }

  // 에러(패닉) 상황 핸들링
  private async _handlePanicError(e: Exception): Promise<void> {
    // 패닉 상태 전환
    this.isPanic = true;

    // 작업 매니저에서 작업 제거
    this.taskManagerService.stopTask(this.taskId);

    // 작업 중지
    this.taskService.repository.updateOneBy(
      { id: this.taskId },
      { process: false, panic: true, status: false },
    );

    // 에러 로깅
    this.taskLoggerService.error({
      message: TASK_MESSAGE.ERROR,
      errorMessage: e.code,
      stack: e.stack,
    });
  }

  // 에러(노말) 상황 핸들링
  private async _handleNormalError(e: Exception): Promise<void> {
    // 작업 상태
    this.taskService.repository.updateOneBy(
      { id: this.taskId },
      { process: false, panic: true, status: false },
    );

    // 에러 로깅
    this.taskLoggerService.warn({
      message: TASK_MESSAGE.WARN,
      errorMessage: e.code,
      stack: e.stack,
    });
  }

  /**
   * 발생가능한 에러 핸들링
   * @param e ERROR
   * @returns Exception
   */
  private _errorFormat(e: any): Exception {
    // missing response
    if (e.message?.match(EXCEPTION_CODE.ERR1002)) {
      return new Exception(EXCEPTION_CODE.ERR1002, EXCEPTION_LEVEL.NORMAL);
    }

    // ETIMEDOUT
    if (e.message?.match(EXCEPTION_CODE.ERR1003)) {
      return new Exception(EXCEPTION_CODE.ERR1003, EXCEPTION_LEVEL.NORMAL);
    }

    // could not detect network
    if (e.message?.match(EXCEPTION_CODE.ERR1004)) {
      return new Exception(EXCEPTION_CODE.ERR1004, EXCEPTION_LEVEL.NORMAL);
    }

    // Expected rpc error
    if (e.message?.match(EXCEPTION_CODE.ERR1005)) {
      return new Exception(EXCEPTION_CODE.ERR1005, EXCEPTION_LEVEL.NORMAL);
    }

    // Too Many Requests
    if (e.message?.match(EXCEPTION_CODE.ERR1009)) {
      return new Exception(EXCEPTION_CODE.ERR1009, EXCEPTION_LEVEL.NORMAL);
    }

    // processing response error
    if (e.message?.match(EXCEPTION_CODE.ERR1010)) {
      return new Exception(EXCEPTION_CODE.ERR1010, EXCEPTION_LEVEL.NORMAL);
    }

    // underlying network changed
    if (e.message?.match(EXCEPTION_CODE.ERR1011)) {
      return new Exception(EXCEPTION_CODE.ERR1011, EXCEPTION_LEVEL.NORMAL);
    }

    // Too many connections
    if (e.message?.match(EXCEPTION_CODE.ERR1008)) {
      return new Exception(EXCEPTION_CODE.ERR1008, EXCEPTION_LEVEL.PANIC);
    }

    // missing revert data in call exception
    if (e.message?.match(EXCEPTION_CODE.ERR1007)) {
      return new Exception(EXCEPTION_CODE.ERR1007, EXCEPTION_LEVEL.PANIC);
    }

    // unknown exception
    return new Exception(EXCEPTION_CODE.ERR1001, EXCEPTION_LEVEL.PANIC);
  }
}
