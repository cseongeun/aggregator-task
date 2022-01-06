import { Injectable } from '@nestjs/common';
import { Task } from '@seongeun/aggregator-base/lib/entity';
import { TaskService } from '@seongeun/aggregator-base/lib/service';
import { EntityManager, TransactionManager, UpdateResult } from 'typeorm';
import {
  TASK_EXCEPTION_CODE,
  TASK_EXCEPTION_LEVEL,
} from '../exception/task-exception.constant';
import { Exception } from '../exception/task-exception.dto';
import { TaskLogger } from '../logger/task-logger';
import { TaskManager } from '../manager/task-manager';
import { TASK_MESSAGE } from '../message/task-message.constant';

@Injectable()
export class TaskHandlerService {
  constructor(
    public readonly taskService: TaskService,
    public readonly logger: TaskLogger,
    public readonly manager: TaskManager,
  ) {}

  /**
   * DB 작업 상태 가져오기
   * @param taskId taskId
   */
  async getTask(taskId: string): Promise<Task> {
    return this.taskService.repository.findOneBy({ id: taskId });
  }

  /**
   * DB 작업 상태 업데이트
   * @param taskId 작업 아이디
   * @param params 작업 상태 업데이트
   * @param manager 트랜잭션 매니저
   */
  async updateTask(
    taskId: string,
    params: { pid?: number; blockNumber?: number; data?: any },
    @TransactionManager() manager: EntityManager,
  ): Promise<UpdateResult> {
    return this.taskService.repository.updateOneBy(
      { id: taskId },
      params,
      manager,
    );
  }

  /**
   * 작업 변경 상태 확인
   * @param prevTask 기존 작업 상태
   */
  async checkChangedTask(prevTask: Task): Promise<Task> {
    const { id: taskId } = prevTask;
    const nowTask = await this.getTask(taskId);

    // 작업 실행 상태
    if (prevTask.status !== nowTask.status) {
      // 재 실행
      if (nowTask.status) {
        await this.handleRestart(taskId);
      } else {
        await this.handleStop(taskId);
      }
    }
    return nowTask;
  }

  /**
   * 작업 성공 시 핸들링
   * @param id 작업 아이디
   * @param params 로깅 데이터
   */
  async handleSuccess(
    taskId: string,
    params: {
      result: Record<string, any> | null;
      elapsedTime: string;
    },
  ): Promise<void> {
    this.logger.log(taskId, {
      message: TASK_MESSAGE.SUCCESS,
      work: params?.result,
      elapsedTime: params.elapsedTime,
    });

    // 진행 초기화
    await this.taskService.repository.update(
      { id: taskId },
      { active: false, latestElapsedSecond: params.elapsedTime },
    );
  }

  /**
   * 작업 에러 시 핸들링
   * @param taskId 작업 아이디
   * @param error 발생 에러
   * @returns
   */
  async handleError(taskId: string, error: Error | Exception): Promise<void> {
    let wrappedError: Exception;

    if (error instanceof Exception) {
      wrappedError = error;
    } else {
      wrappedError = this.wrappedError(error);
    }

    // 에러 핸들링 분기
    switch (wrappedError.level) {
      case TASK_EXCEPTION_LEVEL.NORMAL: {
        return this._handleNormalError(taskId, {
          errorMessage: wrappedError.code,
          stack: error.stack,
        });
      }

      default: {
        return this._handlePanicError(taskId, {
          errorMessage: wrappedError.code,
          stack: error.stack,
        });
      }
    }
  }

  async handleInitialStart(taskId: string): Promise<void> {
    await this.logger.log(taskId, {
      message: TASK_MESSAGE.INITIAL_START,
    });
  }
  /**
   * 작업 재 실행 시 핸들링
   * @param taskId 작업 아이디
   */
  async handleRestart(taskId: string): Promise<void> {
    await this.manager.startTask(taskId);

    await this.logger.log(taskId, {
      message: TASK_MESSAGE.RESTART_MANUALLY,
    });
  }

  async handleStop(taskId: string): Promise<void> {
    await this.manager.stopTask(taskId);

    await this.logger.log(taskId, {
      message: TASK_MESSAGE.STOP_MANUALLY,
    });
  }

  /**
   * 작업 노말 에러 발생 시 핸들링
   * @param id 작업 아이디
   * @param params 로깅 데이터
   */
  private async _handleNormalError(
    taskId: string,
    params: { errorMessage?: string; stack?: any },
  ): Promise<void> {
    this.logger.warn(taskId, {
      message: TASK_MESSAGE.WARN,
      errorMessage: params?.errorMessage,
      stack: params?.stack,
    });

    // 진행 초기화
    await this.taskService.repository.update({ id: taskId }, { active: false });
  }

  /**
   * 작업 패닉 에러 발생 시 핸들링
   * @param id 작업 아이디
   * @param params 로깅 데이터
   */
  private async _handlePanicError(
    taskId: string,
    params: { errorMessage?: string; stack?: any },
  ): Promise<void> {
    this.logger.error(taskId, {
      message: TASK_MESSAGE.ERROR,
      errorMessage: params?.errorMessage,
      stack: params?.stack,
    });

    // 작업 중단 (리스너는 무중단)
    this.manager.stopTask(taskId);

    // 중단 상태로 변경
    await this.taskService.repository.update(
      { id: taskId },
      { status: false, active: false, panic: true },
    );
  }

  /**
   * 발생가능한 에러 래핑 핸들링
   * @param e ERROR
   * @returns Exception
   */
  wrappedError(e: Error | Exception): Exception {
    if (e instanceof Exception) {
      return e;
    }

    // missing response
    if (e.message?.match(TASK_EXCEPTION_CODE.ERR1002)) {
      return new Exception(
        TASK_EXCEPTION_CODE.ERR1002,
        TASK_EXCEPTION_LEVEL.NORMAL,
      );
    }

    // ETIMEDOUT
    if (e.message?.match(TASK_EXCEPTION_CODE.ERR1003)) {
      return new Exception(
        TASK_EXCEPTION_CODE.ERR1003,
        TASK_EXCEPTION_LEVEL.NORMAL,
      );
    }

    // could not detect network
    if (e.message?.match(TASK_EXCEPTION_CODE.ERR1004)) {
      return new Exception(
        TASK_EXCEPTION_CODE.ERR1004,
        TASK_EXCEPTION_LEVEL.NORMAL,
      );
    }

    // Expected rpc error
    if (e.message?.match(TASK_EXCEPTION_CODE.ERR1005)) {
      return new Exception(
        TASK_EXCEPTION_CODE.ERR1005,
        TASK_EXCEPTION_LEVEL.NORMAL,
      );
    }

    // Too Many Requests
    if (e.message?.match(TASK_EXCEPTION_CODE.ERR1009)) {
      return new Exception(
        TASK_EXCEPTION_CODE.ERR1009,
        TASK_EXCEPTION_LEVEL.NORMAL,
      );
    }

    // processing response error
    if (e.message?.match(TASK_EXCEPTION_CODE.ERR1010)) {
      return new Exception(
        TASK_EXCEPTION_CODE.ERR1010,
        TASK_EXCEPTION_LEVEL.NORMAL,
      );
    }

    // underlying network changed
    if (e.message?.match(TASK_EXCEPTION_CODE.ERR1011)) {
      return new Exception(
        TASK_EXCEPTION_CODE.ERR1011,
        TASK_EXCEPTION_LEVEL.NORMAL,
      );
    }

    // Too many connections
    if (e.message?.match(TASK_EXCEPTION_CODE.ERR1008)) {
      return new Exception(
        TASK_EXCEPTION_CODE.ERR1008,
        TASK_EXCEPTION_LEVEL.PANIC,
      );
    }

    // missing revert data in call exception
    if (e.message?.match(TASK_EXCEPTION_CODE.ERR1007)) {
      return new Exception(
        TASK_EXCEPTION_CODE.ERR1007,
        TASK_EXCEPTION_LEVEL.PANIC,
      );
    }

    // unknown exception
    return new Exception(
      TASK_EXCEPTION_CODE.ERR1001,
      TASK_EXCEPTION_LEVEL.PANIC,
    );
  }
}
