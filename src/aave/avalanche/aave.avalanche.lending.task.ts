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
  TaskService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { Token } from '@seongeun/aggregator-base/lib/entity';
import { AaveAvalancheSchedulerService } from '@seongeun/aggregator-defi-protocol';
import { TaskBase } from '../../task.base';
import { TaskManagerService } from '../../app/manager/task-manager.service';
import { TaskLoggerService } from '../../app/logger/task-logger.service';

@Injectable()
export class AaveAvalancheLendingTask extends TaskBase {
  constructor(
    public readonly taskService: TaskService,
    public readonly taskManagerService: TaskManagerService,
    // public readonly taskLoggerService: TaskLoggerService,
    public readonly lendingService: LendingService,
    public readonly tokenService: TokenService,
    public readonly context: AaveAvalancheSchedulerService,
  ) {
    super(
      'AAVE-AVALANCHE-LENDING',
      taskService,
      taskManagerService,
      // taskLoggerService,
    );
  }

  async registerLending(
    marketInfo: {
      supplyToken: Token;
      borrowToken: Token;
      address: string;
      data?: any | any[];
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
        data: marketInfo.data ? JSON.stringify(marketInfo.data) : null,
      },
      manager,
    );
    return true;
  }

  async refreshLending(
    marketInfo: {
      supplyToken: Token;
      borrowToken: Token;
      availableLiquidity;
      totalStableDebt;
      totalVariableDebt;
      liquidityRate;
      variableBorrowRate;
      stableBorrowRate;
      variableBorrowIndex;
      liquidationThreshold;
      reserveFactor;
      data?: any | any[];
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
        data: marketInfo.data ? JSON.stringify(marketInfo.data) : null,
        status: true,
      },
      manager,
    );
  }

  async run(): Promise<Record<string, any> | null> {
    try {
      console.log('wow');
      const reserves = await this.context.getLendingReserveList();
      const marketInfos = await this.context.getLendingMarketInfos(reserves);
      for await (const marketInfo of marketInfos) {
        let queryRunner: QueryRunner | null = null;

        try {
          if (isNull(marketInfo)) {
            continue;
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

          const lendingMarketToken =
            await this.tokenService.repository.findOneBy({
              network: this.context.network,
              address: reserve,
              status: true,
            });
          console.log(lendingMarketToken);

          if (isUndefined(lendingMarketToken)) {
            continue;
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
              continue;
            }
          }

          queryRunner = await getConnection().createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

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
                data: {
                  reserve,
                  aTokenDecimals: aTokenDecimals.toString(),
                  sTokenDecimals: sTokenDecimals.toString(),
                  vTokenDecimals: vTokenDecimals.toString(),
                },
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
                data: {
                  reserve,
                  aTokenDecimals: aTokenDecimals.toString(),
                  sTokenDecimals: sTokenDecimals.toString(),
                  vTokenDecimals: vTokenDecimals.toString(),
                },
              },
              queryRunner.manager,
            );
          }

          await queryRunner.commitTransaction();
        } catch (e) {
          console.log(e);
          if (!isNull(queryRunner)) {
            await queryRunner.rollbackTransaction();
          }
        } finally {
          if (!isNull(queryRunner) && !queryRunner?.isReleased) {
            await queryRunner.release();
          }
        }
      }
      return {};
    } catch (e) {
      console.log(e);
    } finally {
    }
  }
}
