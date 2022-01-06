import { Injectable } from '@nestjs/common';
import BigNumberJs from 'bignumber.js';
import { Token } from '@seongeun/aggregator-base/lib/entity';
import {
  FarmService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { BakerySwapBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/bakery-swap/binance-smart-chain/bakery-swap.binance-smart-chain.scheduler.service';
import { BigNumber } from 'ethers';
import {
  EntityManager,
  getConnection,
  QueryRunner,
  TransactionManager,
} from 'typeorm';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { FarmTaskTemplate } from '../../task-app/template/farm.task.template';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import { div, isZero, mul } from '@seongeun/aggregator-util/lib/bignumber';
import {
  ONE_DAY_SECONDS,
  ONE_YEAR_DAYS,
  ZERO,
} from '@seongeun/aggregator-util/lib/constant';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import { getFarmAssetName } from '@seongeun/aggregator-util/lib/naming';
import { getSafeERC20BalanceOf } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import { TASK_EXCEPTION_LEVEL } from '../../task-app/exception/task-exception.constant';

@Injectable()
export class BakerySwapBinanceSmartChainFarmTask extends FarmTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly farmService: FarmService,
    public readonly tokenService: TokenService,
    public readonly context: BakerySwapBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.BAKERY_SWAP_BINANCE_SMART_CHAIN_FARM,
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

  getNetworkPid(): Promise<BigNumber> {
    return this.context.getFarmTotalLength();
  }

  getFarmInfos(sequence: number[]): Promise<
    {
      lpToken: string;
      allocPoint: BigNumber;
      lastRewardBlock: BigNumber;
      accTokenPerShare: BigNumber;
      exists: boolean;
    }[]
  > {
    return this.context.getFarmInfos(sequence);
  }

  async getFarmState(): Promise<{
    totalAllocPoint: BigNumber;
    rewardValueInOneYear: BigNumberJs;
  }> {
    const [totalAllocPoint, rewardPerBlock] = await Promise.all([
      this.context.getFarmTotalAllocPoint(),
      this.context.getFarmRewardPerBlock(),
    ]);

    // 블록 당 리워드 갯수
    const rewardAmountInOneBlock = divideDecimals(
      rewardPerBlock.toString(),
      this.getRewardToken().decimals,
    );

    // 하루 총 생성 블록 갯수
    const blocksInOneDay = div(ONE_DAY_SECONDS, this.context.blockTimeSecond);

    // 하루 총 리워드 갯수
    const rewardAmountInOneDay = mul(rewardAmountInOneBlock, blocksInOneDay);

    // 하루 총 리워드 USD 가격
    const rewardValueInOneDay = mul(
      rewardAmountInOneDay,
      this.getRewardToken().priceUSD,
    );

    // 일년 총 리워드 USD 가격
    const rewardValueInOneYear = mul(ONE_YEAR_DAYS, rewardValueInOneDay);

    return {
      totalAllocPoint,
      rewardValueInOneYear,
    };
  }

  async registerFarm(
    farmInfo: { pid: number; lpToken: string },
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

    await this.farmService.repository.createOneBy(
      {
        protocol: this.context.protocol,
        name: this.getFarmDetail().name,
        address: this.getFarmDetail().address,
        pid: farmInfo.pid,
        assets: getFarmAssetName([stakeToken], [this.getRewardToken()]),
        stakeTokens: [stakeToken],
        rewardTokens: [this.getRewardToken()],
        data: JSON.stringify({ lpToken: farmInfo.lpToken }),
      },
      manager,
    );
    return true;
  }
  async refreshFarm(
    farmInfo: { pid: number; allocPoint: BigNumber; lpToken: string },
    farmState: {
      totalAllocPoint: BigNumber;
      rewardValueInOneYear: BigNumberJs;
    },
    @TransactionManager() manager?: EntityManager,
  ): Promise<void> {
    const { id, stakeTokens, status } =
      await this.farmService.repository.findOneBy(
        {
          protocol: this.context.protocol,
          name: this.getFarmDetail().name,
          address: this.getFarmDetail().address,
          pid: farmInfo.pid,
          data: JSON.stringify({ lpToken: farmInfo.lpToken }),
        },
        manager,
      );

    if (!status) return;

    const targetStakeToken = stakeTokens[0];

    // 총 유동 수량
    const liquidityAmount = divideDecimals(
      await getSafeERC20BalanceOf(
        this.context.provider,
        this.context.multiCallAddress,
        targetStakeToken.address,
        this.getFarmDetail().address,
      ),
      targetStakeToken.decimals,
    );

    // 총 유동 가치(USD)
    const liquidityValue = mul(liquidityAmount, targetStakeToken.priceUSD);
    // 총 점유율
    const sharePointOfFarm = div(
      farmInfo.allocPoint,
      farmState.totalAllocPoint,
    );

    // 1년 할당 리워드 가치 (USD)
    const allocatedRewardValueInOneYear = mul(
      farmState.rewardValueInOneYear,
      sharePointOfFarm,
    );

    // apr
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
      lastRewardBlock: BigNumber;
      accTokenPerShare: BigNumber;
      exists: boolean;
    };
    farmState: {
      totalAllocPoint: BigNumber;
      rewardValueInOneYear: BigNumberJs;
    };
  }): Promise<Record<string, any>> {
    let queryRunner: QueryRunner | null = null;
    try {
      const { pid, farmInfo, farmState } = data;

      const farm = await this.farmService.repository.findOneBy({
        protocol: this.context.protocol,
        name: this.getFarmDetail().name,
        address: this.getFarmDetail().address,
        pid,
      });

      if (isNull(farmInfo)) return { success: true };

      const { lpToken, allocPoint, exists } = farmInfo;

      if (isZero(allocPoint) || !exists) {
        if (!isUndefined(farm)) {
          await this.farmService.repository.updateOneBy(
            {
              id: farm.id,
            },
            {
              status: false,
            },
          );
          return { success: true };
        }
      }

      queryRunner = await getConnection().createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      let initialized = true;
      if (isUndefined(farm)) {
        initialized = await this.registerFarm(
          { pid, lpToken },
          queryRunner.manager,
        );
      }
      if (initialized) {
        await this.refreshFarm(
          { pid, allocPoint, lpToken },
          farmState,
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