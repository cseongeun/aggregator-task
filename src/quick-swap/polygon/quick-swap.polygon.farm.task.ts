import { Injectable } from '@nestjs/common';
import { Token } from '@seongeun/aggregator-base/lib/entity';
import BigNumberJs from 'bignumber.js';

import {
  FarmService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { QuickSwapPolygonSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/quick-swap/polygon/quick-swap.polygon.scheduler.service';
import { BigNumber } from 'ethers';
import { EntityManager, getConnection, QueryRunner } from 'typeorm';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { FarmTaskTemplate } from '../../task-app/template/farm.task.template';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import {
  add,
  div,
  isGreaterThanOrEqual,
  isZero,
  mul,
} from '@seongeun/aggregator-util/lib/bignumber';
import {
  ONE_DAY_SECONDS,
  ONE_YEAR_DAYS,
  ZERO,
} from '@seongeun/aggregator-util/lib/constant';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import { TASK_EXCEPTION_LEVEL } from '../../task-app/exception/task-exception.constant';
import { getFarmAssetName } from '@seongeun/aggregator-util/lib/naming';

@Injectable()
export class QuickSwapPolygonFarmTask extends FarmTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly farmService: FarmService,
    public readonly tokenService: TokenService,
    public readonly context: QuickSwapPolygonSchedulerService,
  ) {
    super(
      TASK_ID.QUICK_SWAP_POLYGON_FARM,
      taskHandlerService,
      farmService,
      tokenService,
      context,
    );
  }

  getRewardToken(): Token {
    return this.context.token;
  }

  getFarmDetail(): { name: string; address: string } {
    const target = this.context.farm;
    return {
      name: target.name,
      address: target.address,
    };
  }

  async getNetworkPid(): Promise<BigNumber> {
    return this.context.getFarmTotalLength();
  }

  async getFarmInfos(sequence: number[]): Promise<
    {
      farmAddress: string;
      stakingTokenAddress: string;
      rewardTokenAAddress: string;
      rewardTokenBAddress: string;
      totalSupply: BigNumber;
      rewardRateA: BigNumber;
      rewardRateB: BigNumber;
      periodFinish: BigNumber;
    }[]
  > {
    return this.context.getFarmInfos(sequence);
  }

  async getLocalFarmState(farmInfo: {
    rewardTokenA;
    rewardRateA;
    rewardTokenB;
    rewardRateB;
  }): Promise<{ rewardValueInOneYear: BigNumberJs }> {
    // 하루 총 생성 블록 갯수
    const blocksInOneDay = div(ONE_DAY_SECONDS, this.context.blockTimeSecond);

    // 하루 총 리워드 갯수
    const rewardTokenAAmountInOneDay = mul(
      divideDecimals(farmInfo.rewardRateA, farmInfo.rewardTokenA.decimals),
      blocksInOneDay,
    );

    const rewardTokenBAmountInOneDay = mul(
      divideDecimals(farmInfo.rewardRateB, farmInfo.rewardTokenB.decimals),
      blocksInOneDay,
    );

    // 하루 총 리워드 USD 가격
    const rewardTokenAValueInOneDay = mul(
      rewardTokenAAmountInOneDay,
      farmInfo.rewardTokenA.priceValue,
    );

    const rewardTokenBValueInOneDay = mul(
      rewardTokenBAmountInOneDay,
      farmInfo.rewardTokenB.priceValue,
    );

    // 일년 총 리워드 USD 가격
    const rewardValueInOneYear = mul(
      ONE_YEAR_DAYS,
      add(rewardTokenAValueInOneDay, rewardTokenBValueInOneDay),
    );

    return {
      rewardValueInOneYear,
    };
  }

  async getGlobalFarmState(): Promise<{ currentBlockNumber: number }> {
    const currentBlockNumber = await this.context.getBlockNumber();
    return { currentBlockNumber };
  }

  async getRelatedTokens(tokens: {
    stakingTokenAddress: string;
    rewardTokenAAddress: string;
    rewardTokenBAddress: string;
  }): Promise<{ stakeToken: Token; rewardTokenA: Token; rewardTokenB: Token }> {
    const [stakeToken, rewardTokenA, rewardTokenB] = await Promise.all([
      this.tokenService.repository.findOneBy({
        address: tokens.stakingTokenAddress,
        status: true,
        network: { chainId: this.context.chainId, status: true },
      }),
      this.tokenService.repository.findOne({
        address: tokens.rewardTokenAAddress,
        status: true,
        network: { chainId: this.context.chainId, status: true },
      }),
      this.tokenService.repository.findOneBy({
        address: tokens.rewardTokenBAddress,
        status: true,
        network: { chainId: this.context.chainId, status: true },
      }),
    ]);
    return { stakeToken, rewardTokenA, rewardTokenB };
  }

  async registerFarm(
    farmInfo: {
      pid: number;
      farmAddress: string;
      stakeToken: Token;
      rewardTokenA: Token;
      rewardTokenB: Token;
      rewardTokenAAddress: string;
      rewardTokenBAddress: string;
    },
    manager?: EntityManager,
  ): Promise<boolean> {
    // 스테이킹 토큰 및 리워드 토큰 미등록 or 비활성화 일 경우, 팜 등록 제외
    if (
      isUndefined(farmInfo.stakeToken) ||
      isUndefined(farmInfo.rewardTokenA) ||
      isUndefined(farmInfo.rewardTokenB)
    ) {
      return false;
    }

    await this.farmService.repository.createOneBy(
      {
        protocol: this.context.protocol,
        name: this.getFarmDetail().name,
        address: farmInfo.farmAddress,
        pid: farmInfo.pid,
        assets: getFarmAssetName(
          [farmInfo.stakeToken],
          [farmInfo.rewardTokenA, farmInfo.rewardTokenB],
        ),
        stakeTokens: [farmInfo.stakeToken],
        rewardTokens: [farmInfo.rewardTokenA, farmInfo.rewardTokenB],
        data: JSON.stringify({
          rewardA: farmInfo.rewardTokenAAddress,
          rewardB: farmInfo.rewardTokenBAddress,
        }),
      },
      manager,
    );

    return true;
  }

  async refreshFarm(
    farmInfo: {
      pid: number;
      farmAddress: string;
      stakeToken: Token;
      rewardTokenA: Token;
      rewardTokenB: Token;
      totalSupply: BigNumber;
      rewardRateA: BigNumber;
      rewardRateB: BigNumber;
      rewardTokenAAddress: string;
      rewardTokenBAddress: string;
    },
    globalState: { currentBlockNumber: number },
    manager?: EntityManager,
  ): Promise<void> {
    const { id, stakeTokens, status } =
      await this.farmService.repository.findOneBy(
        {
          protocol: this.context.protocol,
          name: this.getFarmDetail().name,
          address: farmInfo.farmAddress,
          pid: farmInfo.pid,
        },
        manager,
      );

    if (!status) return;

    const rewardValueInOneYear = await this.getLocalFarmState({
      rewardTokenA: farmInfo.rewardTokenA,
      rewardRateA: farmInfo.rewardRateA,
      rewardTokenB: farmInfo.rewardTokenB,
      rewardRateB: farmInfo.rewardRateB,
    });

    const targetStakeToken = stakeTokens[0];

    // 총 유동 수량
    const liquidityAmount = divideDecimals(
      farmInfo.totalSupply,
      targetStakeToken.decimals,
    );

    // 총 유동 가치(USD)
    const liquidityValue = mul(liquidityAmount, targetStakeToken.priceUSD);

    // apr
    const farmApr =
      isZero(rewardValueInOneYear) || isZero(liquidityValue)
        ? ZERO
        : mul(div(rewardValueInOneYear, liquidityValue), 100);

    await this.farmService.repository.updateOneBy(
      {
        id,
      },
      {
        liquidityAmount: liquidityAmount.toString(),
        liquidityValue: liquidityValue.toString(),
        apr: farmApr.toString(),
        data: JSON.stringify({
          rewardTokenAAddress: farmInfo.rewardTokenAAddress,
          rewardTokenBAddress: farmInfo.rewardTokenBAddress,
        }),
        status: true,
      },
      manager,
    );
  }

  async process(data: {
    pid: number;
    farmInfo: {
      farmAddress: string;
      stakingTokenAddress: string;
      rewardTokenAAddress: string;
      rewardTokenBAddress: string;
      totalSupply: BigNumber;
      rewardRateA: BigNumber;
      rewardRateB: BigNumber;
      periodFinish: BigNumber;
    };
    globalState: { currentBlockNumber: number };
  }): Promise<Record<string, any>> {
    let queryRunner: QueryRunner | null = null;

    try {
      const { pid, farmInfo, globalState } = data;

      if (isNull(farmInfo)) return { success: true };
      const {
        farmAddress,
        stakingTokenAddress,
        rewardTokenAAddress,
        rewardTokenBAddress,
        totalSupply,
        rewardRateA,
        rewardRateB,
        periodFinish,
      } = farmInfo;

      const farm = await this.farmService.repository.findOneBy({
        protocol: this.context.protocol,
        name: this.getFarmDetail().name,
        address: farmAddress,
        pid,
      });

      if (isGreaterThanOrEqual(globalState.currentBlockNumber, periodFinish)) {
        if (!isUndefined(farm)) {
          await this.farmService.repository.updateOneBy(
            { id: farm.id },
            { status: false },
          );
        }
        return { success: true };
      }

      queryRunner = await getConnection().createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      let initialized = true;

      const { stakeToken, rewardTokenA, rewardTokenB } =
        await this.getRelatedTokens({
          stakingTokenAddress,
          rewardTokenAAddress,
          rewardTokenBAddress,
        });

      if (isUndefined(farm)) {
        initialized = await this.registerFarm(
          {
            pid,
            farmAddress,
            stakeToken,
            rewardTokenA,
            rewardTokenB,
            rewardTokenAAddress,
            rewardTokenBAddress,
          },
          queryRunner.manager,
        );
      }

      if (initialized) {
        await this.refreshFarm(
          {
            pid,
            farmAddress,
            stakeToken,
            rewardTokenA,
            rewardTokenB,
            totalSupply,
            rewardRateA,
            rewardRateB,
            rewardTokenAAddress,
            rewardTokenBAddress,
          },
          globalState,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();
      return { success: true };
    } catch (e) {
      if (!isNull(queryRunner)) {
        await queryRunner.rollbackTransaction();
      }
      const wrappedError = this.taskHandlerService.wrappedError(e);

      // 인터널 노말 에러 시
      if (wrappedError.level === TASK_EXCEPTION_LEVEL.NORMAL) {
        return { success: false };
      }

      // 인터널 패닉 에러 시
      throw Error(e);
    } finally {
      if (!isNull(queryRunner) && !queryRunner?.isReleased) {
        await queryRunner.release();
      }
    }
  }
}
