import { BigNumber } from '@ethersproject/bignumber';
import { Injectable } from '@nestjs/common';
import BigNumberJs from 'bignumber.js';
import {
  EntityManager,
  getConnection,
  QueryRunner,
  TransactionManager,
} from 'typeorm';
import { AutoFarmBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/auto-farm/binance-smart-chain/auto-farm.binance-smart-chain.scheduler.service';
import {
  FarmService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { Token } from '@seongeun/aggregator-base/lib/entity';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import { div, isZero, mul } from '@seongeun/aggregator-util/lib/bignumber';
import {
  ONE_DAY_SECONDS,
  ONE_YEAR_DAYS,
  ZERO,
} from '@seongeun/aggregator-util/lib/constant';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import { getSafeCheckCA } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import { getFarmAssetName } from '@seongeun/aggregator-util/lib/naming';
import { TASK_EXCEPTION_LEVEL } from '../../task-app/exception/task-exception.constant';
import { TASK_ID } from '../../task-app.constant';
import { FarmTaskTemplate } from '../../task-app/template/farm.task.template';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';

@Injectable()
export class AutoFarmBinanceSmartChainFarmTask extends FarmTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly farmService: FarmService,
    public readonly tokenService: TokenService,
    public readonly context: AutoFarmBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.AUTO_FARM_BINANCE_SMART_CHAIN_FARM,
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

  async getFarmState(): Promise<{
    totalAllocPoint: BigNumber;
    rewardValueInOneYear: BigNumberJs;
  }> {
    const [totalAllocPoint, rewardPerBlock] = await Promise.all([
      this.context.getFarmTotalAllocPoint(),
      this.context.getFarmRewardPerBlock(),
    ]);

    const rewardAmountInOneBlock = divideDecimals(
      rewardPerBlock.toString(),
      this.getRewardToken().decimals,
    );
    const blocksInOneDay = div(ONE_DAY_SECONDS, this.context.blockTimeSecond);
    const rewardAmountInOneDay = mul(rewardAmountInOneBlock, blocksInOneDay);
    const rewardValueInOneDay = mul(
      rewardAmountInOneDay,
      this.getRewardToken().priceUSD,
    );
    const rewardValueInOneYear = mul(ONE_YEAR_DAYS, rewardValueInOneDay);
    return {
      totalAllocPoint,
      rewardValueInOneYear,
    };
  }

  async getFarmInfos(sequence: number[]): Promise<
    {
      want: string;
      allocPoint: BigNumber;
      lastRewardBlock: BigNumber;
      accAUTOPerShare: BigNumber;
      strat: string;
    }[]
  > {
    return this.context.getFarmInfos(sequence);
  }

  async registerFarm(
    farmInfo: {
      pid: number;
      lpToken: string;
      strat: string;
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

    await this.farmService.repository.createOneBy(
      {
        protocol: this.context.protocol,
        name: this.getFarmDetail().name,
        address: this.getFarmDetail().address,
        pid: farmInfo.pid,
        assets: getFarmAssetName([stakeToken], [this.getRewardToken()]),
        stakeTokens: [stakeToken],
        rewardTokens: [this.getRewardToken()],
        data: JSON.stringify({ strat: farmInfo.strat }),
      },
      manager,
    );
    return true;
  }

  async refreshFarm(
    farmInfo: {
      pid: number;
      allocPoint: BigNumber;
      strat: string;
    },
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
          pid: farmInfo.pid,
        },
        manager,
      );

    if (!status) return;

    const targetStakeToken = stakeTokens[0];

    const liquidityAmount = divideDecimals(
      (await this.context.getFarmStratShareTotal(farmInfo.strat)).toString(),
      targetStakeToken.decimals,
    );

    const liquidityValue = mul(liquidityAmount, targetStakeToken.priceUSD);

    const sharePointOfFarm = div(
      farmInfo.allocPoint,
      farmState.totalAllocPoint,
    );

    const allocatedRewardValueInOneYear = mul(
      farmState.rewardValueInOneYear,
      sharePointOfFarm,
    );

    const farmApr = isZero(allocatedRewardValueInOneYear)
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
        data: JSON.stringify({ strat: farmInfo.strat }),
      },
      manager,
    );
  }

  async process(data: {
    pid: number;
    farmInfo: {
      want: string;
      allocPoint: BigNumber;
      lastRewardBlock: BigNumber;
      accAUTOPerShare: BigNumber;
      strat: string;
    };
    farmState: {
      totalAllocPoint: BigNumber;
      rewardValueInOneYear: BigNumberJs;
    };
  }): Promise<Record<string, any>> {
    let queryRunner: QueryRunner | null = null;

    try {
      const { pid, farmInfo, farmState } = data;

      if (isNull(farmInfo)) return { success: true };

      const farm = await this.farmService.repository.findOneBy({
        protocol: this.context.protocol,
        name: this.getFarmDetail().name,
        address: this.getFarmDetail().name,
        pid,
      });

      const { want, allocPoint, strat } = farmInfo;

      const isValidStrat = await getSafeCheckCA(
        this.context.provider,
        this.context.multiCallAddress,
        strat,
      );

      if (!isValidStrat) return { success: true };

      if (isZero(allocPoint)) {
        if (!isUndefined(farm)) {
          await this.farmService.repository.updateOneBy(
            {
              id: farm.id,
            },
            { status: false },
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
          { pid, lpToken: want, strat },
          queryRunner.manager,
        );
      }

      if (initialized) {
        await this.refreshFarm(
          {
            pid,
            allocPoint,
            strat,
          },
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
