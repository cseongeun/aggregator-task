import { Injectable } from '@nestjs/common';
import { Task } from '@seongeun/aggregator-base/lib/entity';
import { TaskService } from '@seongeun/aggregator-base/lib/service';
import { UpdateResult } from 'typeorm';
import { HandlerService } from './app/handler/handler.service';

@Injectable()
export class AppService {
  constructor(
    private readonly taskService: TaskService,
    private readonly handlerService: HandlerService,
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
      const isImplementation =
        this.handlerService.manager.isRegisteredTaskJob(id);

      // DB에 작업 등록이 되어있지만 작업 스크립트가 구현되지않은 경우.
      if (!isImplementation) {
        await this.handlerService.notFoundTask(id);

        return;
      }

      if (status) {
        // 작업 및 작업 리스너 시작
        await this.handlerService.manager.startTaskJob(id);
        await this.handlerService.manager.startTaskListenerJob(id);
        await this.handlerService.handleInitialStart(id);
      } else {
        // 작업 리스너만 시작
        await this.handlerService.manager.startTaskListenerJob(id);
      }
    });
  }
}
