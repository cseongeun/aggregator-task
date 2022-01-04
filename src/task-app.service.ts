import { Injectable } from '@nestjs/common';
import { Task } from '@seongeun/aggregator-base/lib/entity';
import { TaskService } from '@seongeun/aggregator-base/lib/service';
import { UpdateResult } from 'typeorm';
import { TaskManagerService } from './task-app/manager/task-manager.service';

@Injectable()
export class TaskAppService {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskManagerService: TaskManagerService,
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
        process: false,
        panic: false,
        status: true,
      },
    );
  }

  // 작업 중단 상태로 업데이트
  async stopTask(id: string): Promise<UpdateResult> {
    return this.taskService.repository.updateOneBy(
      {
        id,
      },
      {
        process: false,
        status: false,
      },
    );
  }

  /**
   * 순차적으로 모든 작업 시작
   */
  async start() {
    await this.resetAllTasks();

    const tasks = await this.getAllTasks();

    tasks.forEach(async ({ id }: { id: string }) => {
      const isImplementation = this.taskManagerService.isRegisteredTask(id);

      // DB에 작업 등록이 되어있지만 작업 스크립트가 구현되지않은 경우.
      if (!isImplementation) {
        await this.stopTask(id);

        return;
      }

      await this.taskManagerService.startAllTaskWithListener(id);
    });
  }
}
