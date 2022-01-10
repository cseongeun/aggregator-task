import { Injectable } from '@nestjs/common';
import {
  EntityManager,
  getConnection,
  QueryRunner,
  TransactionManager,
} from 'typeorm';
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
import { TaskBase } from '../../task.base';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { TASK_EXCEPTION_LEVEL } from '../../task-app/exception/task-exception.constant';
import { TASK_ID } from '../../task-app.constant';
import { BigNumber } from 'ethers';

@Injectable()
export class AaveAvalancheLendingTask extends TaskBase {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly lendingService: LendingService,
    private readonly tokenService: TokenService,
    private readonly context: AaveAvalancheSchedulerService,
  ) {
    super(TASK_ID.AAVE_AVALANCHE_LENDING, taskHandlerService);
  }

  loggingForm(): Record<string, any> {
    return {
      total: 0,
      success: 0,
      warn: 0,
    };
  }

  async registerLending(
    marketInfo: {
      supplyToken: Token;
      borrowToken: Token;
      address: string;
      reserve: BigNumber;
      aTokenDecimals: string;
      sTokenDecimals: string;
      vTokenDecimals: string;
    },
    @TransactionManager() manager?: EntityManager,
  ): Promise<boolean> {
    if (
      isUndefined(marketInfo.supplyToken) ||
      isUndefined(marketInfo.borrowToken)
    ) {
      return false;
    }
    await this.lendingService.repository.createOneBy(
      {
        protocol: this.context.protocol,
        supplyToken: marketInfo.supplyToken,
        borrowToken: marketInfo.borrowToken,
        address: marketInfo.address,
        data: {
          reserve: marketInfo.reserve,
          aTokenDecimals: marketInfo.aTokenDecimals,
          sTokenDecimals: marketInfo.sTokenDecimals,
          vTokenDecimals: marketInfo.vTokenDecimals,
        },
      },
      manager,
    );
    return true;
  }

  async refreshLending(
    marketInfo: {
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
      reserve: BigNumber;
      aTokenDecimals: string;
      sTokenDecimals: string;
      vTokenDecimals: string;
    },
    @TransactionManager() manager?: EntityManager,
  ): Promise<void> {
    // liquidity
    const marketLiquidity = marketInfo.availableLiquidity;

    const liquidityAmount = divideDecimals(
      marketLiquidity.toString(),
      marketInfo.supplyToken.decimals,
    );

    const liquidityValue = mul(
      liquidityAmount,
      marketInfo.supplyToken.priceUSD,
    );

    // borrow
    const marketBorrow = add(
      marketInfo.totalVariableDebt,
      marketInfo.totalStableDebt,
    );

    const borrowAmount = divideDecimals(
      marketBorrow,
      marketInfo.borrowToken.decimals,
    );

    const borrowValue = mul(borrowAmount, marketInfo.borrowToken.priceUSD);

    // supply
    const supplyAmount = add(liquidityAmount, borrowAmount);

    const supplyValue = mul(supplyAmount, marketInfo.supplyToken.priceUSD);

    // borrow supply apy
    const supplyApy = mul(
      div(marketInfo.liquidityRate.toString(), pow(10, 27)),
      100,
    );

    const borrowApy = mul(
      div(marketInfo.variableBorrowRate.toString(), pow(10, 27)),
      100,
    );

    // collateral, reserve factor
    const collateralFactor = div(marketInfo.liquidationThreshold, 100);

    const reserveFactor = div(marketInfo.reserveFactor, 100);

    await this.lendingService.repository.updateOneBy(
      {
        protocol: this.context.protocol,
        supplyToken: marketInfo.supplyToken,
        borrowToken: marketInfo.borrowToken,
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
        collateralFactor: collateralFactor.toString(),
        reserveFactor: reserveFactor.toString(),
        data: {
          reserve: marketInfo.reserve,
          aTokenDecimals: marketInfo.aTokenDecimals,
          sTokenDecimals: marketInfo.sTokenDecimals,
          vTokenDecimals: marketInfo.vTokenDecimals,
        },
        status: true,
      },
      manager,
    );
  }

  async process(data: { marketInfo }): Promise<Record<string, any>> {
    let queryRunner: QueryRunner | null = null;

    try {
      const { marketInfo } = data;

      if (isNull(marketInfo)) {
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
      } = marketInfo;

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
          return { success: true };
        }
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

  async run(): Promise<Record<string, any> | null> {
    const log = this.loggingForm();

    try {
      const reserves = await this.context.getLendingReserveList();
      const marketInfos = await this.context.getLendingMarketInfos(reserves);

      log.total = marketInfos.length;

      for await (const marketInfo of marketInfos) {
        const { success } = await this.process({ marketInfo });

        if (success) {
          log.success += 1;
          continue;
        }
        log.warn += 1;
      }

      return log;
    } catch (e) {
      throw Error(e);
    }
  }
}
