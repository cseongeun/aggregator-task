import { Injectable } from '@nestjs/common';
import BigNumberJs from 'bignumber.js';
import { BigNumber } from 'ethers';
import { EntityManager, getConnection, QueryRunner } from 'typeorm';
import { Token } from '@seongeun/aggregator-base/lib/entity';
import {
  FarmService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { ONE_YEAR_SECONDS, ZERO } from '@seongeun/aggregator-util/lib/constant';
import {
  add,
  div,
  isGreaterThan,
  isZero,
  mul,
  sub,
} from '@seongeun/aggregator-util/lib/bignumber';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import { getFarmAssetName } from '@seongeun/aggregator-util/lib/naming';
import { TASK_EXCEPTION_LEVEL } from '../../task-app/exception/task-exception.constant';
import { TASK_ID } from '../../task-app.constant';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { FarmTaskTemplate } from '../../task-app/template/farm.task.template';
import { MdexHecoSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/mdex/heco/mdex.heco.scheduler.service';

@Injectable()
export class MdexHecoFarmTask extends FarmTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly farmService: FarmService,
    public readonly tokenService: TokenService,
    public readonly context: MdexHecoSchedulerService,
  ) {
    super(
      TASK_ID.MDEX_HECO_FARM,
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
    const [currentBlockNumber, totalAllocPoint, halvingPeriod, startBlock] =
      await Promise.all([
        this.context.getBlockNumber(),
        this.context.getFarmTotalAllocPoint(),
        this.context.getFarmHalvingPeriod(),
        this.context.getFarmStartBlock(),
      ]);
    let rewardAmountInOneYear = ZERO;

    let l: any = currentBlockNumber;
    const afterOneYearBlockNumber = add(
      currentBlockNumber,
      div(ONE_YEAR_SECONDS, this.context.blockTimeSecond),
    );
    // eslint-disable-next-line prefer-const
    let [n, m]: [any, any] = await Promise.all([
      this.context.getFarmPhase(currentBlockNumber),
      this.context.getFarmPhase(afterOneYearBlockNumber.toString()),
    ]);

    while (isGreaterThan(m, n)) {
      n = add(n, 1);
      const r = add(mul(n, halvingPeriod), startBlock);
      rewardAmountInOneYear = add(
        rewardAmountInOneYear,
        mul(sub(r, l), await this.context.getFarmReward(r.toString())),
      );
      l = r;

      rewardAmountInOneYear = add(
        rewardAmountInOneYear,
        mul(
          sub(afterOneYearBlockNumber, l),
          await this.context.getFarmReward(afterOneYearBlockNumber.toString()),
        ),
      );
    }

    // 일년 총 리워드 갯수
    const totalRewardAmountInOneYear = divideDecimals(
      rewardAmountInOneYear,
      this.getRewardToken().decimals,
    );
    // 일년 총 리워드 USD 가격
    const rewardValueInOneYear = mul(
      totalRewardAmountInOneYear,
      this.getRewardToken().priceUSD,
    );

    return {
      totalAllocPoint,
      rewardValueInOneYear,
    };
  }

  async getFarmInfos(sequence: number[]): Promise<
    {
      lpToken: string;
      allocPoint: BigNumber;
      lastRewardBlock: BigNumber;
      accMdxPerShare: BigNumber;
      accMultiLpPerShare: BigNumber;
      totalAmount: BigNumber;
    }[]
  > {
    return this.context.getFarmInfos(sequence);
  }

  async registerFarm(
    farmInfo: { pid: number; lpToken: string },
    manager?: EntityManager,
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
      },
      manager,
    );
    return true;
  }

  async refreshFarm(
    farmInfo: {
      pid: number;
      allocPoint: BigNumber;
      totalAmount: BigNumber;
    },
    farmState: {
      totalAllocPoint: BigNumber;
      rewardValueInOneYear: BigNumberJs;
    },
    manager?: EntityManager,
  ): Promise<void> {
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

    // 총 유동 수량
    const liquidityAmount = divideDecimals(
      farmInfo.totalAmount,
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
      accMdxPerShare: BigNumber;
      accMultiLpPerShare: BigNumber;
      totalAmount: BigNumber;
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
        address: this.getFarmDetail().address,
        pid,
      });

      const { lpToken, allocPoint, totalAmount } = farmInfo;

      if (isZero(allocPoint)) {
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

      // 풀 추가 등록
      let initialized = true;
      if (isUndefined(farm)) {
        initialized = await this.registerFarm(
          { pid, lpToken },
          queryRunner.manager,
        );
      }

      if (initialized) {
        await this.refreshFarm(
          { pid, allocPoint, totalAmount },
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
