import { Injectable } from '@nestjs/common';
import { Token } from '@seongeun/aggregator-base/lib/entity';
import {
  FarmService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { BigNumber } from 'ethers';
import { EntityManager, getConnection, QueryRunner } from 'typeorm';
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
import { getFarmAssetName } from '@seongeun/aggregator-util/lib/naming';
import { TASK_EXCEPTION_LEVEL } from '../../task-app/exception/task-exception.constant';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { FarmTaskTemplate } from '../../task-app/template/farm.task.template';
import { PancakeSwapBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/pancake-swap/binance-smart-chain/pancake-swap.binance-smart-chain.scheduler.service';

@Injectable()
export class PancakeSwapBinanceSmartChainFarm_2_Task extends FarmTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly farmService: FarmService,
    public readonly tokenService: TokenService,
    public readonly context: PancakeSwapBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.PANCAKE_SWAP_BINANCE_SMART_CHAIN_FARM_2,
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
    return BigNumber.from(await this.context.getFarm2TotalLength());
  }

  async getFarmInfos(sequence: number[]): Promise<
    {
      id: string;
      reward: string;
      startBlock: string;
      endBlock: string;
      stakeToken: {
        id: string;
        name: string;
        decimals: string;
        symbol: string;
      };
      earnToken: {
        id: string;
        name: string;
        decimals: string;
        symbol: string;
      };
    }[]
  > {
    return this.context.getFarm2Infos(sequence.length);
  }

  async getLocalFarmState(
    farmInfo: Record<string, any>,
  ): Promise<Record<string, any>> {
    return;
  }

  async getGlobalFarmState(): Promise<{ currentBlockNumber: number }> {
    const currentBlockNumber = await this.context.getBlockNumber();
    return { currentBlockNumber };
  }

  async registerFarm(
    farmInfo: {
      address: string;
      pid: number;
      stakeToken: {
        id: string;
        name: string;
        symbol: string;
        decimals: string;
      };
      rewardToken: {
        id: string;
        name: string;
        symbol: string;
        decimals: string;
      };
    },
    manager?: EntityManager,
  ): Promise<boolean> {
    const [stakeToken, rewardToken] = await Promise.all([
      this.tokenService.repository.findOneBy({
        address: farmInfo.stakeToken.id,
        status: true,
        network: {
          chainId: this.context.chainId,
          status: true,
        },
      }),
      this.tokenService.repository.findOneBy({
        address: farmInfo.rewardToken.id,
        status: true,
        network: {
          chainId: this.context.chainId,
          status: true,
        },
      }),
    ]);

    if (isUndefined(stakeToken) || isUndefined(rewardToken)) return false;

    await this.farmService.repository.createOneBy(
      {
        protocol: this.context.protocol,
        name: this.getFarmDetail().name,
        address: farmInfo.address,
        pid: farmInfo.pid,
        assets: getFarmAssetName([stakeToken], [rewardToken]),
        stakeTokens: [stakeToken],
        rewardTokens: [rewardToken],
      },
      manager,
    );
    return true;
  }

  async refreshFarm(
    farmInfo: { address: string; pid: number; reward: string },
    globalState: { currentBlockNumber: number },
    manager?: EntityManager,
  ): Promise<void> {
    const { id, stakeTokens, rewardTokens, status } =
      await this.farmService.repository.findOneBy(
        {
          protocol: this.context.protocol,
          name: this.getFarmDetail().name,
          address: farmInfo.address,
          pid: farmInfo.pid,
        },
        manager,
      );

    if (!status) return;

    const targetStakeToken = stakeTokens[0];
    const targetRewardToken = rewardTokens[0];

    // 총 유동 수량
    const liquidityAmount = divideDecimals(
      await getSafeERC20BalanceOf(
        this.context.provider,
        this.context.multiCallAddress,
        targetStakeToken.address,
        farmInfo.address,
      ),
      targetStakeToken.decimals,
    );

    // 총 유동 가치(USD)
    const liquidityValue = mul(liquidityAmount, targetStakeToken.priceUSD);

    // 1일 총 블록 갯수
    const blocksInOneDay = div(ONE_DAY_SECONDS, this.context.blockTimeSecond);

    // 1일 총 리워드 갯수
    const rewardAmountInOneDay = mul(blocksInOneDay, farmInfo.reward);

    // 1일 총 리워드 가치(USD)
    const rewardValueInOneDay = mul(
      rewardAmountInOneDay,
      targetRewardToken.priceUSD,
    );

    // 1년 총 리워드 가치(USD)
    const rewardValueInOneYear = mul(ONE_YEAR_DAYS, rewardValueInOneDay);

    // apr
    const farmApr = isZero(rewardValueInOneYear)
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
      id: string;
      reward: string;
      startBlock: string;
      endBlock: string;
      stakeToken: {
        id: string;
        name: string;
        decimals: string;
        symbol: string;
      };
      earnToken: {
        id: string;
        name: string;
        decimals: string;
        symbol: string;
      };
    };
    globalState: { currentBlockNumber: number };
  }): Promise<Record<string, any>> {
    let queryRunner: QueryRunner | null = null;

    try {
      const { pid, farmInfo, globalState } = data;

      if (isNull(farmInfo)) return { success: true };

      const { id, stakeToken, earnToken, reward, endBlock } = farmInfo;

      const farm = await this.farmService.repository.findOneBy({
        protocol: this.context.protocol,
        name: this.getFarmDetail().name,
        address: id,
        pid,
      });

      if (isGreaterThanOrEqual(globalState.currentBlockNumber, endBlock)) {
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
      if (isUndefined(farm)) {
        initialized = await this.registerFarm(
          { address: id, pid, stakeToken, rewardToken: earnToken },
          queryRunner.manager,
        );
      }

      if (initialized) {
        await this.refreshFarm(
          { address: id, pid, reward },
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
