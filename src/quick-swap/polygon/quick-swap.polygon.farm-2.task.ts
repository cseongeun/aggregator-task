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
import { getSafeERC20BalanceOf } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import { TASK_EXCEPTION_LEVEL } from '../../task-app/exception/task-exception.constant';
import { getFarmAssetName } from '@seongeun/aggregator-util/lib/naming';

@Injectable()
export class QuickSwapPolygonFarm_2_Task extends FarmTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly farmService: FarmService,
    public readonly tokenService: TokenService,
    public readonly context: QuickSwapPolygonSchedulerService,
  ) {
    super(
      TASK_ID.QUICK_SWAP_POLYGON_FARM_2,
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
    const target = this.context.farm2;
    return {
      name: target.name,
      address: target.address,
    };
  }

  async getNetworkPid(): Promise<BigNumber> {
    return this.context.getFarm2TotalLength();
  }

  async getFarmInfos(sequence: number[]): Promise<
    {
      farmAddress: string;
      stakingTokenAddress: string;
      rewardsTokenAddress: string;
      totalSupply: BigNumber;
      rewardRate: BigNumber;
      periodFinish: BigNumber;
    }[]
  > {
    return this.context.getFarm2Infos(sequence);
  }

  async getLocalFarmState(farmInfo: {
    rewardToken: Token;
    rewardRate: BigNumber;
  }): Promise<{ rewardValueInOneYear: BigNumberJs }> {
    // 하루 총 생성 블록 갯수
    const blocksInOneDay = div(ONE_DAY_SECONDS, this.context.blockTimeSecond);

    // 하루 총 리워드 갯수
    const rewardTokenAmountInOneDay = mul(
      divideDecimals(farmInfo.rewardRate, farmInfo.rewardToken.decimals),
      blocksInOneDay,
    );

    // 하루 총 리워드 USD 가격
    const rewardTokenValueInOneDay = mul(
      rewardTokenAmountInOneDay,
      farmInfo.rewardToken.priceUSD,
    );

    // 일년 총 리워드 USD 가격
    const rewardValueInOneYear = mul(ONE_YEAR_DAYS, rewardTokenValueInOneDay);

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
    rewardsTokenAddress: string;
  }): Promise<{ stakeToken: Token; rewardToken: Token }> {
    const [stakeToken, rewardToken] = await Promise.all([
      this.tokenService.repository.findOneBy({
        address: tokens.stakingTokenAddress,
        status: true,
        network: { chainId: this.context.chainId, status: true },
      }),

      this.tokenService.repository.findOneBy({
        address: tokens.rewardsTokenAddress,
        status: true,
        network: { chainId: this.context.chainId, status: true },
      }),
    ]);
    return { stakeToken, rewardToken };
  }

  async registerFarm(
    farmInfo: {
      pid: number;
      farmAddress: string;
      stakeToken: Token;
      rewardToken: Token;
    },
    manager?: EntityManager,
  ): Promise<boolean> {
    if (isUndefined(farmInfo.stakeToken) || isUndefined(farmInfo.rewardToken)) {
      return false;
    }

    await this.farmService.repository.createOneBy(
      {
        protocol: this.context.protocol,
        name: this.getFarmDetail().name,
        address: farmInfo.farmAddress,
        pid: farmInfo.pid,
        assets: getFarmAssetName([farmInfo.stakeToken], [farmInfo.rewardToken]),
        stakeTokens: [farmInfo.stakeToken],
        rewardTokens: [farmInfo.rewardToken],
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
      rewardToken: Token;
      rewardRate: BigNumber;
      totalSupply: BigNumber;
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

    const { rewardValueInOneYear } = await this.getLocalFarmState({
      rewardToken: farmInfo.rewardToken,
      rewardRate: farmInfo.rewardRate,
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
      rewardsTokenAddress: string;
      totalSupply: BigNumber;
      rewardRate: BigNumber;
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
        rewardsTokenAddress,
        totalSupply,
        rewardRate,
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

      const { stakeToken, rewardToken } = await this.getRelatedTokens({
        stakingTokenAddress,
        rewardsTokenAddress,
      });

      if (isUndefined(farm)) {
        initialized = await this.registerFarm(
          {
            pid,
            farmAddress,
            stakeToken,
            rewardToken,
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
            rewardToken,
            rewardRate,
            totalSupply,
          },
          globalState,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();
      return { success: true };
    } catch (e) {
      await this.taskHandlerService.transaction.rollbackTransaction(
        queryRunner,
      );
      const wrappedError = this.taskHandlerService.wrappedError(e);

      // 인터널 노말 에러 시
      if (wrappedError.level === TASK_EXCEPTION_LEVEL.NORMAL) {
        return { success: false };
      }

      // 인터널 패닉 에러 시
      throw Error(e);
    } finally {
      await this.taskHandlerService.transaction.releaseTransaction(queryRunner);
    }
  }
}
