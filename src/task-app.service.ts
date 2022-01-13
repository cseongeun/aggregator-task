import { Injectable } from '@nestjs/common';
import { Task } from '@seongeun/aggregator-base/lib/entity';
import { TaskService } from '@seongeun/aggregator-base/lib/service';
import { UpdateResult } from 'typeorm';
import { TaskHandlerService } from './task-app/handler/task-handler.service';

@Injectable()
export class TaskAppService {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskHandler: TaskHandlerService,
  ) {}

  // 모든 작업 가져오기
  async getAllTasks(): Promise<Task[]> {
    return this.taskService.repository.findAllBy();
  }

  // 모든 작업 초기화
  async resetAllTasks(): Promise<UpdateResult> {
    return this.taskService.repository.updateOneBy(
      {},
      {
        active: false,
        panic: false,
        // status: true,
      },
    );
  }

  /**
   * 순차적으로 모든 작업 시작
   */
  async start() {
    await this.resetAllTasks();

    const tasks = await this.getAllTasks();

    tasks.forEach(async ({ id, status }: { id: string; status: boolean }) => {
      const isImplementation = this.taskHandler.manager.isRegisteredTaskJob(id);

      // DB에 작업 등록이 되어있지만 작업 스크립트가 구현되지않은 경우.
      if (!isImplementation) {
        await this.taskHandler.notFoundTask(id);

        return;
      }

      if (status) {
        // 작업 및 작업 리스너 시작
        await this.taskHandler.manager.startTaskJob(id);
        await this.taskHandler.manager.startTaskListenerJob(id);
        await this.taskHandler.handleInitialStart(id);
      } else {
        // 작업 리스너만 시작
        await this.taskHandler.manager.startTaskListenerJob(id);
      }
    });
  }
}
