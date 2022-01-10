import { Injectable } from '@nestjs/common';
import {
  LendingService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { VenusBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/venus/binance-smart-chain/venus.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../task-app.constant';
import { TaskBase } from '../../task.base';
import {
  EntityManager,
  getConnection,
  QueryRunner,
  TransactionManager,
} from 'typeorm';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import { isZeroAddress } from '@seongeun/aggregator-util/lib/address';
import { TASK_EXCEPTION_LEVEL } from '../../task-app/exception/task-exception.constant';
import { Token } from '@seongeun/aggregator-base/lib/entity';
import { BigNumber } from 'ethers';
import { getSafeERC20BalanceOf } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import {
  add,
  div,
  mul,
  sub,
  toFixed,
} from '@seongeun/aggregator-util/lib/bignumber';
import {
  ONE_DAY_SECONDS,
  ONE_YEAR_DAYS,
} from '@seongeun/aggregator-util/lib/constant';

@Injectable()
export class VenusBinanceSmartChainLendingTask extends TaskBase {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly lendingService: LendingService,
    private readonly tokenService: TokenService,
    private readonly context: VenusBinanceSmartChainSchedulerService,
  ) {
    super(TASK_ID.VENUS_BINANCE_SMART_CHAIN_LENDING, taskHandlerService);
  }

  loggingForm(): Record<string, any> {
    return {
      total: 0,
      success: 0,
      warn: 0,
    };
  }

  async registerLending(
    marketInfo: { supplyToken: Token; borrowToken: Token; address: string },
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
      },
      manager,
    );
    return true;
  }

  async refreshLending(
    marketInfo: {
      supplyToken: Token;
      borrowToken: Token;
      address: string;
      supplyRatePerBlock: BigNumber;
      borrowRatePerBlock: BigNumber;
      collateralFactorMantissa: BigNumber;
      reserveFactorMantissa: BigNumber;
      totalBorrows: BigNumber;
      totalReserves: BigNumber;
    },
    @TransactionManager() manager?: EntityManager,
  ): Promise<void> {
    /**
     * Liquidity
     */
    const marketLiquidity = isZeroAddress(marketInfo.supplyToken.address)
      ? await this.context.getBalance(marketInfo.address)
      : await getSafeERC20BalanceOf(
          this.context.provider,
          this.context.multiCallAddress,
          marketInfo.supplyToken.address,
          marketInfo.address,
        );

    const liquidityAmount = divideDecimals(
      marketLiquidity.toString(),
      marketInfo.supplyToken.decimals,
    );

    const liquidityValue = mul(
      liquidityAmount,
      marketInfo.supplyToken.priceUSD,
    );

    /**
     * Borrow
     */
    const borrowAmount = divideDecimals(marketInfo.totalBorrows, 18);
    const borrowValue = mul(borrowAmount, marketInfo.borrowToken.priceUSD);

    /**
     * Reserve
     */
    const reserveAmount = divideDecimals(marketInfo.totalReserves, 18);
    const reserveValue = mul(reserveAmount, marketInfo.supplyToken.priceUSD);

    /**
     * Supply
     */
    const supplyAmount = sub(add(liquidityAmount, borrowAmount), reserveAmount);

    const supplyValue = mul(supplyAmount, marketInfo.supplyToken.priceUSD);

    /**
     * Blocks One Year
     */
    const blocksInOneYear = mul(
      div(ONE_DAY_SECONDS, this.context.blockTimeSecond),
      ONE_YEAR_DAYS,
    );

    /**
     * Supply, Borrow Rate
     */
    const supplyRate = divideDecimals(marketInfo.supplyRatePerBlock, 18);
    const borrowRate = divideDecimals(marketInfo.borrowRatePerBlock, 18);

    /**
     * Supply, Borrow Apr
     */
    const supplyApr = mul(mul(supplyRate, blocksInOneYear), 100);
    const borrowApr = mul(mul(borrowRate, blocksInOneYear), 100);

    /**
     * Collateral, Reserve Factor
     */
    const collateralFactor = mul(
      toFixed(divideDecimals(marketInfo.collateralFactorMantissa, 18)),
      100,
    );

    const reserveFactor = mul(
      toFixed(divideDecimals(marketInfo.reserveFactorMantissa, 18)),
      100,
    );

    await this.lendingService.repository.updateOneBy(
      {
        protocol: this.context.protocol,
        supplyToken: marketInfo.supplyToken,
        borrowToken: marketInfo.borrowToken,
        address: marketInfo.address,
      },
      {
        liquidityAmount: liquidityAmount.toString(),
        liquidityValue: liquidityValue.toString(),
        supplyAmount: supplyAmount.toString(),
        supplyValue: supplyValue.toString(),
        supplyApr: supplyApr.toString(),
        borrowAmount: borrowAmount.toString(),
        borrowValue: borrowValue.toString(),
        borrowApr: borrowApr.toString(),
        reserveAmount: reserveAmount.toString(),
        reserveValue: reserveValue.toString(),
        collateralFactor: collateralFactor.toString(),
        reserveFactor: reserveFactor.toString(),
        status: true,
      },
      manager,
    );
  }

  async process(data: { marketAddress: string }): Promise<Record<string, any>> {
    let queryRunner: QueryRunner | null = null;

    try {
      const { marketAddress } = data;

      const {
        underlying,
        supplyRatePerBlock,
        borrowRatePerBlock,
        totalBorrows,
        totalReserves,
        reserveFactorMantissa,
        market: { isListed, collateralFactorMantissa },
      } = await this.context.getLendingMarketInfos(marketAddress);

      const lendingMarketToken = await this.tokenService.repository.findOneBy({
        network: this.context.network,
        address: underlying,
        status: true,
      });

      if (isUndefined(lendingMarketToken)) {
        success: true;
      }

      const lendingMarket = await this.lendingService.repository.findOneBy({
        protocol: this.context.protocol,
        supplyToken: lendingMarketToken,
        borrowToken: lendingMarketToken,
        address: marketAddress,
      });

      if (!isListed) {
        if (!isUndefined(lendingMarket)) {
          await this.lendingService.repository.updateOneBy(
            {
              protocol: this.context.protocol,
              supplyToken: lendingMarketToken,
              borrowToken: lendingMarketToken,
              address: marketAddress,
            },
            { status: false },
          );
          return { success: true };
        }
      }

      queryRunner =
        await this.taskHandlerService.transaction.startTransaction();

      let initialized = true;
      if (isUndefined(lendingMarket)) {
        initialized = await this.registerLending(
          {
            supplyToken: lendingMarketToken,
            borrowToken: lendingMarketToken,
            address: marketAddress,
          },
          queryRunner.manager,
        );
      }

      if (initialized) {
        await this.refreshLending(
          {
            supplyToken: lendingMarketToken,
            borrowToken: lendingMarketToken,
            address: marketAddress,
            supplyRatePerBlock,
            borrowRatePerBlock,
            collateralFactorMantissa,
            reserveFactorMantissa,
            totalBorrows,
            totalReserves,
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

  async run(): Promise<Record<string, any>> {
    const log = this.loggingForm();

    try {
      const allMarketAddress = await this.context.getLendingAllMarkets();

      log.total = allMarketAddress.length;

      for await (const marketAddress of allMarketAddress) {
        const { success } = await this.process({ marketAddress });

        if (success) {
          log.success += 0;
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
