import { Injectable } from '@nestjs/common';
import { isNull } from '@seongeun/aggregator-util/lib/type';
import { getConnection, QueryRunner } from 'typeorm';

@Injectable()
export class TaskTransaction {
  /**
   * 트랜잭션 시작
   * @returns 트랜잭션이 시작된 QueryRunner
   */
  async startTransaction(): Promise<QueryRunner> {
    const queryRunner = await getConnection().createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');
    return queryRunner;
  }

  /**
   * 트랜잭션 커밋
   * @param queryRunner 커밋한 트랜잭션을 가진 QueryRunner
   * @returns -
   */
  async commitTransaction(queryRunner: QueryRunner): Promise<void> {
    return queryRunner.commitTransaction();
  }

  /**
   * 트랜잭션 롤백
   * @param queryRunner 롤백할 트랜잭션을 가진 QueryRunner
   */
  async rollbackTransaction(queryRunner: QueryRunner): Promise<void> {
    if (!isNull(queryRunner)) {
      await queryRunner.rollbackTransaction();
    }
  }

  /**
   * 트랜잭션 해제
   * @param queryRunner 해제할 트랜잭션을 가진 QueryRunner
   */
  async releaseTransaction(queryRunner: QueryRunner): Promise<void> {
    if (!isNull(queryRunner) && !queryRunner?.isReleased) {
      await queryRunner.release();
    }
  }
}
