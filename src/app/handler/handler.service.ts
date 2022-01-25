import { Injectable } from '@nestjs/common';
import { Task } from '@seongeun/aggregator-base/lib/entity';
import { TaskService } from '@seongeun/aggregator-base/lib/service';
import { isCronString } from '@seongeun/aggregator-util/lib/type';
import { EntityManager, TransactionManager, UpdateResult } from 'typeorm';
import {
  Exception,
  EXCEPTION_CODE,
  EXCEPTION_LEVEL,
} from '@seongeun/aggregator-common';
import { Logger } from './libs/logger/logger';
import { Manager } from './libs/manager/manager';
import { MESSAGE } from './libs/message/message';
import { Transaction } from './libs/transaction/transaction';

@Injectable()
export class HandlerService {
  constructor(
    public readonly taskService: TaskService,
    public readonly transaction: Transaction,
    public readonly logger: Logger,
    public readonly manager: Manager,
  ) {}

  async changeActive(taskId: string, active: boolean): Promise<UpdateResult> {
    return this.taskService.repository.updateOneBy({ id: taskId }, { active });
  }

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

  async handleInitialStart(taskId: string): Promise<void> {
    await this.logger.log(taskId, {
      message: MESSAGE.INITIAL_START,
    });
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
      message: MESSAGE.SUCCESS,
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
      case EXCEPTION_LEVEL.NORMAL: {
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

  /**
   * 작업 변경 상태 확인
   * @param prevTask 기존 작업 상태
   */
  async handleTaskListener(prevTask: Task): Promise<Task> {
    const { id: taskId, status: prevStatus, cron: prevCron } = prevTask;

    const nowTask = await this.getTask(taskId);

    const { status: nowStatus, cron: nowCron } = nowTask;

    // 작업 실행
    if (prevStatus !== nowStatus) {
      // 재 실행
      if (nowStatus) {
        await this._handleRestart(taskId);
      } else {
        await this._handleStop(taskId, MESSAGE.PANIC_STOP);
      }
    }

    // 작업 크론
    if (prevCron !== nowCron) {
      if (isCronString(nowCron)) {
        await this._handleChangeCron(taskId, nowCron);
      } else {
        // TODO: 로직 추가
        console.log('invalid cron');
      }
    }
    return nowTask;
  }

  /**
   * 작업 리스너 에러 발생 시 핸들링
   * @param taskId 작업 아이디
   */
  async handleListenerError(taskId: string, e: Error): Promise<void> {
    await this.logger.error(taskId, {
      message: MESSAGE.LISTENER_EXCEPTION,
      stack: e.stack,
    });
  }

  /**
   * 등록된 작업이 확인되지않을 경우 핸들링
   * @param taskId 작업 아이디
   */
  async notFoundTask(taskId: string): Promise<void> {
    await this.taskService.repository.updateOneBy(
      { id: taskId },
      { active: false, status: false },
    );

    this.logger.error(taskId, { message: MESSAGE.NOT_FOUND_TASK_SCRIPT });
  }

  /**
   * 작업 수동 재 실행 시 핸들링
   * @param taskId 작업 아이디
   */
  private async _handleRestart(taskId: string): Promise<void> {
    await this.manager.startTaskJob(taskId);

    await this.logger.log(taskId, {
      message: MESSAGE.RESTART_MANUALLY,
    });
  }

  /**
   * 작업 수동 중단 시 핸들링
   * @param taskId 작업 아이디
   */
  private async _handleStop(taskId: string, message?: MESSAGE): Promise<void> {
    await this.manager.stopTaskJob(taskId);

    await this.logger.log(taskId, {
      message: message ? message : MESSAGE.STOP_MANUALLY,
    });
  }

  /**
   * 작업 크론 변경 시 핸들링
   * @param taskId
   */
  private async _handleChangeCron(taskId: string, cron: string): Promise<void> {
    await this.manager.updateTaskJobCron(taskId, cron);

    await this.logger.log(taskId, {
      message: MESSAGE.CHANGE_CRON_MANUALLY,
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
      message: MESSAGE.WARN,
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
      message: MESSAGE.ERROR,
      errorMessage: params?.errorMessage,
      stack: params?.stack,
    });

    // 작업 중단 (리스너는 무중단)
    this.manager.stopTaskJob(taskId);

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

    // chain-link oracle type requires "feed" data
    if (e.message?.match(EXCEPTION_CODE.ERR2000)) {
      return new Exception(EXCEPTION_CODE.ERR2000, EXCEPTION_LEVEL.PANIC);
    }

    // nft task requires "path" in task config
    if (e.message?.match(EXCEPTION_CODE.ERR2001)) {
      return new Exception(EXCEPTION_CODE.ERR2001, EXCEPTION_LEVEL.PANIC);
    }

    // unknown exception
    return new Exception(EXCEPTION_CODE.ERR1001, EXCEPTION_LEVEL.PANIC);
  }
}
