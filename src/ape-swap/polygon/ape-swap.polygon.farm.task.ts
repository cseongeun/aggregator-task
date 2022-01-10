import { BigNumber } from '@ethersproject/bignumber';
import { Injectable } from '@nestjs/common';
import BigNumberJs from 'bignumber.js';
import {
  EntityManager,
  getConnection,
  QueryRunner,
  TransactionManager,
} from 'typeorm';
import { ApeSwapPolygonSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/ape-swap/polygon/ape-swap.polygon.scheduler.service';
import {
  FarmService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { Token } from '@seongeun/aggregator-base/lib/entity';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import { add, div, isZero, mul } from '@seongeun/aggregator-util/lib/bignumber';
import {
  ONE_YEAR_SECONDS,
  ZERO,
  ZERO_ADDRESS,
} from '@seongeun/aggregator-util/lib/constant';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import {
  getSafeCheckCA,
  getSafeERC20BalanceOf,
} from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import { getFarmAssetName } from '@seongeun/aggregator-util/lib/naming';
import { TASK_EXCEPTION_LEVEL } from '../../task-app/exception/task-exception.constant';
import { TASK_ID } from '../../task-app.constant';
import { FarmTaskTemplate } from '../../task-app/template/farm.task.template';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';

@Injectable()
export class ApeSwapPolygonFarmTask extends FarmTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly farmService: FarmService,
    public readonly tokenService: TokenService,
    public readonly context: ApeSwapPolygonSchedulerService,
  ) {
    super(
      TASK_ID.APE_SWAP_POLYGON_FARM,
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

  async getFarmInfos(sequence: number[]): Promise<Record<string, any>[]> {
    return this.context.getFarmInfos(sequence);
  }

  async getLocalFarmState(farmInfo: {
    rewarder: string;
    rewarderRewardToken: Token;
    rewardPerSecond: BigNumber;
  }): Promise<{ rewardValueInOneYear: BigNumberJs }> {
    const baseRewardAmountInOneSecond = divideDecimals(
      farmInfo.rewardPerSecond,
      this.getRewardToken().decimals,
    );

    const baseRewardValueInOneSecond = mul(
      baseRewardAmountInOneSecond,
      this.getRewardToken().priceUSD,
    );

    const baseRewardValueInOneYear = mul(
      baseRewardValueInOneSecond,
      ONE_YEAR_SECONDS,
    );

    // 추가 리워드
    let rewarderRewardValueInOneYear = ZERO;
    if (
      farmInfo.rewarder !== ZERO_ADDRESS &&
      !isUndefined(farmInfo.rewarderRewardToken)
    ) {
      const rewarderRewardPerSecond =
        await this.context.getFarmRewarderRewardPerSecond(farmInfo.rewarder);

      const rewarderRewardAmountInOneSecond = divideDecimals(
        rewarderRewardPerSecond,
        farmInfo.rewarderRewardToken.decimals,
      );

      const rewarderRewardValueInOneSecond = mul(
        rewarderRewardAmountInOneSecond,
        farmInfo.rewarderRewardToken.priceUSD,
      );

      rewarderRewardValueInOneYear = mul(
        rewarderRewardValueInOneSecond,
        ONE_YEAR_SECONDS,
      );
    }

    const rewardValueInOneYear = add(
      baseRewardValueInOneYear,
      rewarderRewardValueInOneYear,
    );

    return { rewardValueInOneYear };
  }

  async getGlobalFarmState(): Promise<{
    totalAllocPoint: BigNumber;
    rewardPerSecond: BigNumber;
  }> {
    const [totalAllocPoint, rewardPerSecond] = await Promise.all([
      this.context.getFarmTotalAllocPoint(),
      this.context.getFarmRewardPerSecond(),
    ]);

    return {
      totalAllocPoint,
      rewardPerSecond,
    };
  }

  async registerFarm(
    farmInfo: {
      pid: number;
      lpToken: string;
      rewarder: string;
      rewarderRewardToken: Token;
    },
    @TransactionManager() manager?: EntityManager,
  ): Promise<boolean> {
    const stakeToken: Token = await this.tokenService.repository.findOneBy(
      {
        address: farmInfo.lpToken,
        status: true,
        network: { chainId: this.context.chainId, status: true },
      },
      manager,
    );

    if (isUndefined(stakeToken)) return false;

    if (isUndefined(farmInfo.rewarderRewardToken)) return false;

    const rewardTokens = [this.getRewardToken(), farmInfo.rewarderRewardToken];

    await this.farmService.repository.createOneBy(
      {
        protocol: this.context.protocol,
        name: this.getFarmDetail().name,
        address: this.getFarmDetail().address,
        pid: farmInfo.pid,
        assets: getFarmAssetName([stakeToken], rewardTokens),
        stakeTokens: [stakeToken],
        rewardTokens: rewardTokens,
        data: JSON.stringify({ rewarder: farmInfo.rewarder }),
      },
      manager,
    );
    return true;
  }

  async refreshFarm(
    farmInfo: {
      pid: number;
      allocPoint: BigNumber;
      rewarder: string;
      rewarderRewardToken: Token;
    },
    globalState: {
      totalAllocPoint: BigNumber;
      rewardPerSecond: BigNumber;
    },
    @TransactionManager() manager?: EntityManager,
  ): Promise<void> {
    const { rewardValueInOneYear } = await this.getLocalFarmState({
      rewarder: farmInfo.rewarder,
      rewarderRewardToken: farmInfo.rewarderRewardToken,
      rewardPerSecond: globalState.rewardPerSecond,
    });

    const { id, stakeTokens, status } =
      await this.farmService.repository.findOneBy(
        {
          protocol: this.context.protocol,
          name: this.getFarmDetail().name,
          address: this.getFarmDetail().address,
          pid: farmInfo.pid,
        },
        manager,
      );

    if (!status) return;

    const targetStakeToken = stakeTokens[0];

    const liquidityAmount = divideDecimals(
      await getSafeERC20BalanceOf(
        this.context.provider,
        this.context.multiCallAddress,
        targetStakeToken.address,
        this.getFarmDetail().address,
      ),
      targetStakeToken.decimals,
    );

    const liquidityValue = mul(liquidityAmount, targetStakeToken.priceUSD);

    const sharePointOfFarm = div(
      farmInfo.allocPoint,
      globalState.totalAllocPoint,
    );

    const allocatedRewardValueInOneYear = mul(
      rewardValueInOneYear,
      sharePointOfFarm,
    );

    const farmApr =
      isZero(allocatedRewardValueInOneYear) || isZero(liquidityValue)
        ? ZERO
        : mul(div(allocatedRewardValueInOneYear, liquidityValue), 100);

    await this.farmService.repository.updateOneBy(
      {
        id,
      },
      {
        liquidityAmount: liquidityAmount.toString(),
        liquidityValue: liquidityValue.toString(),
        apr: farmApr.toString(),
        data: JSON.stringify({ rewarder: farmInfo.rewarder }),
        status: true,
      },
      manager,
    );
  }

  async process(data: {
    pid: number;
    farmInfo: {
      lpToken: string;
      allocPoint: BigNumber;
      rewarder: string;
    };
    globalState: {
      totalAllocPoint: BigNumber;
      rewardPerSecond: BigNumber;
    };
  }): Promise<Record<string, any>> {
    let queryRunner: QueryRunner | null = null;

    try {
      const { pid, farmInfo, globalState } = data;

      if (isNull(farmInfo)) return { success: true };

      const farm = await this.farmService.repository.findOneBy({
        protocol: this.context.protocol,
        name: this.getFarmDetail().name,
        address: this.getFarmDetail().address,
        pid,
      });

      const { lpToken, allocPoint } = farmInfo;

      if (isZero(allocPoint)) {
        if (!isUndefined(farm)) {
          await this.farmService.repository.updateOneBy(
            {
              id: farm.id,
            },
            { status: false },
          );
        }
        return { success: true };
      }

      const isValidRewarder = await getSafeCheckCA(
        this.context.provider,
        this.context.multiCallAddress,
        farmInfo.rewarder,
      );

      let rewarderRewardTokenAddress;
      let rewarderRewardToken;

      if (isValidRewarder) {
        rewarderRewardTokenAddress =
          await this.context.getFarmRewarderRewardToken(farmInfo.rewarder);

        rewarderRewardToken = await this.tokenService.repository.findOneBy({
          address: rewarderRewardTokenAddress,
          status: true,
          network: {
            chainId: this.context.chainId,
            status: true,
          },
        });
      }

      queryRunner = await getConnection().createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // 신규 풀 등록
      let initialized = true;
      if (isUndefined(farm)) {
        initialized = await this.registerFarm(
          { pid, lpToken, rewarder: farmInfo.rewarder, rewarderRewardToken },
          queryRunner.manager,
        );
      }

      // 풀 업데이트
      if (initialized) {
        await this.refreshFarm(
          { pid, allocPoint, rewarder: farmInfo.rewarder, rewarderRewardToken },
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
