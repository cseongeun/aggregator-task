import { Injectable } from '@nestjs/common';
import { isNull } from '@seongeun/aggregator-util/lib/type';
import { getConnection, QueryRunner } from 'typeorm';

@Injectable()
export class TaskTransaction {
  async startTransaction(): Promise<QueryRunner> {
    const queryRunner = await getConnection().createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');
    return queryRunner;
  }

  async commitTransaction(queryRunner: QueryRunner): Promise<void> {
    return queryRunner.commitTransaction();
  }

  async rollbackTransaction(queryRunner: QueryRunner): Promise<void> {
    if (!isNull(queryRunner)) {
      await queryRunner.rollbackTransaction();
    }
  }

  async releaseTransaction(queryRunner: QueryRunner): Promise<void> {
    if (!isNull(queryRunner) && !queryRunner?.isReleased) {
      await queryRunner.release();
    }
  }
}
