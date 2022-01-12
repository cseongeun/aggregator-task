import { Injectable } from '@nestjs/common';
import { EntityManager, QueryRunner, TransactionManager } from 'typeorm';
import { BigNumber } from 'ethers';
import { getBatchERC20TokenInfos } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import { add, div, mul, pow } from '@seongeun/aggregator-util/lib/bignumber';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import {
  LendingService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { Token } from '@seongeun/aggregator-base/lib/entity';
import { AaveAvalancheSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/aave/avalanche/aave.avalanche.scheduler.service';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { TASK_EXCEPTION_LEVEL } from '../../task-app/exception/task-exception.constant';
import { TASK_ID } from '../../task-app.constant';
import { LendingTaskTemplate } from '../../task-app/template/lending.task.template';

@Injectable()
export class AaveAvalancheLendingTask extends LendingTaskTemplate {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly lendingService: LendingService,
    public readonly tokenService: TokenService,
    public readonly context: AaveAvalancheSchedulerService,
  ) {
    super(
      TASK_ID.AAVE_AVALANCHE_LENDING,
      taskHandlerService,
      lendingService,
      tokenService,
      context,
    );
  }

  async registerLending(
    lendingInfo: {
      supplyToken: Token;
      borrowToken: Token;
      address: string;
      reserve: string;
      aTokenDecimals: string;
      sTokenDecimals: string;
      vTokenDecimals: string;
    },
    @TransactionManager() manager?: EntityManager,
  ): Promise<boolean> {
    const {
      supplyToken,
      borrowToken,
      address,
      reserve,
      aTokenDecimals,
      sTokenDecimals,
      vTokenDecimals,
    } = lendingInfo;

    if (isUndefined(supplyToken) || isUndefined(borrowToken)) {
      return false;
    }

    await this.lendingService.repository.createOneBy(
      {
        protocol: this.context.protocol,
        supplyToken,
        borrowToken,
        address,
        data: {
          reserve,
          aTokenDecimals,
          sTokenDecimals,
          vTokenDecimals,
        },
      },
      manager,
    );
    return true;
  }

  async refreshLending(
    lendingInfo: {
      supplyToken: Token;
      borrowToken: Token;
      availableLiquidity: BigNumber;
      totalStableDebt: BigNumber;
      totalVariableDebt: BigNumber;
      liquidityRate: BigNumber;
      variableBorrowRate: BigNumber;
      stableBorrowRate: BigNumber;
      variableBorrowIndex: BigNumber;
      liquidationThreshold: BigNumber;
      reserveFactor: BigNumber;
      reserve: string;
      aTokenDecimals: string;
      sTokenDecimals: string;
      vTokenDecimals: string;
    },
    @TransactionManager() manager?: EntityManager,
  ): Promise<void> {
    const {
      supplyToken,
      borrowToken,
      availableLiquidity,
      totalStableDebt,
      totalVariableDebt,
      liquidityRate,
      variableBorrowRate,
      liquidationThreshold,
      reserveFactor,
      reserve,
      aTokenDecimals,
      sTokenDecimals,
      vTokenDecimals,
    } = lendingInfo;

    // liquidity
    const marketLiquidity = availableLiquidity;

    const liquidityAmount = divideDecimals(
      marketLiquidity.toString(),
      supplyToken.decimals,
    );

    const liquidityValue = mul(liquidityAmount, supplyToken.priceUSD);

    // borrow
    const marketBorrow = add(totalVariableDebt, totalStableDebt);

    const borrowAmount = divideDecimals(marketBorrow, borrowToken.decimals);

    const borrowValue = mul(borrowAmount, borrowToken.priceUSD);

    // supply
    const supplyAmount = add(liquidityAmount, borrowAmount);

    const supplyValue = mul(supplyAmount, supplyToken.priceUSD);

    // borrow supply apy
    const supplyApy = mul(div(liquidityRate.toString(), pow(10, 27)), 100);

    const borrowApy = mul(div(variableBorrowRate.toString(), pow(10, 27)), 100);

    // collateral, reserve factor
    const collateralFactorPercent = div(liquidationThreshold, 100);

    const reserveFactorPercent = div(reserveFactor, 100);

    await this.lendingService.repository.updateOneBy(
      {
        protocol: this.context.protocol,
        supplyToken,
        borrowToken,
        address: this.context.lending.address,
      },
      {
        liquidityAmount: liquidityAmount.toString(),
        liquidityValue: liquidityValue.toString(),
        supplyAmount: supplyAmount.toString(),
        supplyValue: supplyValue.toString(),
        supplyApy: supplyApy.toString(),
        borrowAmount: borrowAmount.toString(),
        borrowValue: borrowValue.toString(),
        borrowApy: borrowApy.toString(),
        collateralFactor: collateralFactorPercent.toString(),
        reserveFactor: reserveFactorPercent.toString(),
        data: {
          reserve,
          sTokenDecimals,
          aTokenDecimals,
          vTokenDecimals,
        },
        status: true,
      },
      manager,
    );
  }

  async process(data: {
    lendingInfo: {
      reserve: string;
      aTokenAddress: string;
      stableDebtTokenAddress: string;
      variableDebtTokenAddress: string;
      availableLiquidity: BigNumber;
      totalStableDebt: BigNumber;
      totalVariableDebt: BigNumber;
      liquidityRate: BigNumber;
      variableBorrowRate: BigNumber;
      stableBorrowRate: BigNumber;
      averageStableBorrowRate: BigNumber;
      liquidityIndex: BigNumber;
      variableBorrowIndex: BigNumber;
      lastUpdateTimestamp: number;
      decimals: BigNumber;
      ltv: BigNumber;
      liquidationThreshold: BigNumber;
      liquidationBonus: BigNumber;
      reserveFactor: BigNumber;
      usageAsCollateralEnabled: boolean;
      borrowingEnabled: boolean;
      stableBorrowRateEnabled: boolean;
      isActive: boolean;
      isFrozen: boolean;
    } | null;
  }): Promise<Record<string, any>> {
    let queryRunner: QueryRunner | null = null;

    try {
      const { lendingInfo } = data;

      if (isNull(lendingInfo)) {
        return { success: true };
      }

      const {
        reserve,
        aTokenAddress,
        stableDebtTokenAddress,
        variableDebtTokenAddress,
        availableLiquidity,
        totalStableDebt,
        totalVariableDebt,
        liquidityRate,
        variableBorrowRate,
        stableBorrowRate,
        variableBorrowIndex,
        liquidationThreshold,
        reserveFactor,
        isActive,
        isFrozen,
      } = lendingInfo;

      const lendingMarketToken = await this.tokenService.repository.findOneBy({
        network: this.context.network,
        address: reserve,
        status: true,
      });

      if (isUndefined(lendingMarketToken)) {
        return { success: true };
      }

      const lendingMarket = await this.lendingService.repository.findOneBy({
        protocol: this.context.protocol,
        supplyToken: lendingMarketToken,
        borrowToken: lendingMarketToken,
        address: this.context.lending.address,
      });

      if (isFrozen || !isActive) {
        if (!isUndefined(lendingMarket)) {
          await this.lendingService.repository.updateOneBy(
            {
              protocol: this.context.protocol,
              supplyToken: lendingMarketToken,
              borrowToken: lendingMarketToken,
              address: this.context.lending.address,
            },
            { status: false },
          );
        }
        return { success: true };
      }

      queryRunner =
        await this.taskHandlerService.transaction.startTransaction();

      const [
        { decimals: aTokenDecimals },
        { decimals: vTokenDecimals },
        { decimals: sTokenDecimals },
      ] = await getBatchERC20TokenInfos(
        this.context.provider,
        this.context.multiCallAddress,
        [aTokenAddress, variableDebtTokenAddress, stableDebtTokenAddress],
      );

      let initialized = true;
      if (isUndefined(lendingMarket)) {
        initialized = await this.registerLending(
          {
            supplyToken: lendingMarketToken,
            borrowToken: lendingMarketToken,
            address: this.context.lending.address,
            reserve,
            aTokenDecimals: aTokenDecimals.toString(),
            sTokenDecimals: sTokenDecimals.toString(),
            vTokenDecimals: vTokenDecimals.toString(),
          },
          queryRunner.manager,
        );
      }

      if (initialized) {
        await this.refreshLending(
          {
            supplyToken: lendingMarketToken,
            borrowToken: lendingMarketToken,
            availableLiquidity,
            totalStableDebt,
            totalVariableDebt,
            liquidityRate,
            variableBorrowRate,
            stableBorrowRate,
            variableBorrowIndex,
            liquidationThreshold,
            reserveFactor,
            reserve,
            aTokenDecimals: aTokenDecimals.toString(),
            sTokenDecimals: sTokenDecimals.toString(),
            vTokenDecimals: vTokenDecimals.toString(),
          },
          queryRunner.manager,
        );
      }

      await this.taskHandlerService.transaction.commitTransaction(queryRunner);
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

  async getLendingInfos(): Promise<
    ({
      reserve: string;
      aTokenAddress: string;
      stableDebtTokenAddress: string;
      variableDebtTokenAddress: string;
      availableLiquidity: BigNumber;
      totalStableDebt: BigNumber;
      totalVariableDebt: BigNumber;
      liquidityRate: BigNumber;
      variableBorrowRate: BigNumber;
      stableBorrowRate: BigNumber;
      averageStableBorrowRate: BigNumber;
      liquidityIndex: BigNumber;
      variableBorrowIndex: BigNumber;
      lastUpdateTimestamp: number;
      decimals: BigNumber;
      ltv: BigNumber;
      liquidationThreshold: BigNumber;
      liquidationBonus: BigNumber;
      reserveFactor: BigNumber;
      usageAsCollateralEnabled: boolean;
      borrowingEnabled: boolean;
      stableBorrowRateEnabled: boolean;
      isActive: boolean;
      isFrozen: boolean;
    } | null)[]
  > {
    const reserves = await this.context.getLendingReserveList();
    const lendingInfos = await this.context.getLendingMarketInfos(reserves);
    return lendingInfos;
  }
}
