import { Injectable } from '@nestjs/common';
import {
  LendingService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { HandlerService } from '../../app/handler/handler.service';
import { VenusBinanceSmartChainSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/venus/binance-smart-chain/venus.binance-smart-chain.scheduler.service';
import { TASK_ID } from '../../app.constant';
import { EntityManager, QueryRunner, TransactionManager } from 'typeorm';
import { isUndefined } from '@seongeun/aggregator-util/lib/type';
import { isZeroAddress } from '@seongeun/aggregator-util/lib/address';
import { EXCEPTION_LEVEL } from '../../app/exception/exception.constant';
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
import { LendingTaskTemplate } from '../../app/template/lending.task.template';

@Injectable()
export class VenusBinanceSmartChainLendingTask extends LendingTaskTemplate {
  constructor(
    public readonly handlerService: HandlerService,
    public readonly lendingService: LendingService,
    public readonly tokenService: TokenService,
    public readonly context: VenusBinanceSmartChainSchedulerService,
  ) {
    super(
      TASK_ID.VENUS_BINANCE_SMART_CHAIN_LENDING,
      handlerService,
      lendingService,
      tokenService,
      context,
    );
  }

  async registerLending(
    lendingInfo: { supplyToken: Token; borrowToken: Token; address: string },
    @TransactionManager() manager?: EntityManager,
  ): Promise<boolean> {
    const { supplyToken, borrowToken, address } = lendingInfo;

    if (isUndefined(supplyToken) || isUndefined(borrowToken)) {
      return false;
    }

    await this.lendingService.repository.createOneBy(
      {
        protocol: this.context.protocol,
        supplyToken,
        borrowToken,
        address,
      },
      manager,
    );
    return true;
  }

  async refreshLending(
    lendingInfo: {
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
    const {
      supplyToken,
      borrowToken,
      address,
      supplyRatePerBlock,
      borrowRatePerBlock,
      collateralFactorMantissa,
      reserveFactorMantissa,
      totalBorrows,
      totalReserves,
    } = lendingInfo;

    /**
     * Liquidity
     */
    const marketLiquidity = isZeroAddress(supplyToken.address)
      ? await this.context.getBalance(address)
      : await getSafeERC20BalanceOf(
          this.context.provider,
          this.context.multiCallAddress,
          supplyToken.address,
          address,
        );

    const liquidityAmount = divideDecimals(
      marketLiquidity.toString(),
      supplyToken.decimals,
    );

    const liquidityValue = mul(liquidityAmount, supplyToken.priceUSD);

    /**
     * Borrow
     */
    const borrowAmount = divideDecimals(totalBorrows, 18);
    const borrowValue = mul(borrowAmount, borrowToken.priceUSD);

    /**
     * Reserve
     */
    const reserveAmount = divideDecimals(totalReserves, 18);
    const reserveValue = mul(reserveAmount, supplyToken.priceUSD);

    /**
     * Supply
     */
    const supplyAmount = sub(add(liquidityAmount, borrowAmount), reserveAmount);

    const supplyValue = mul(supplyAmount, supplyToken.priceUSD);

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
    const supplyRate = divideDecimals(supplyRatePerBlock, 18);
    const borrowRate = divideDecimals(borrowRatePerBlock, 18);

    /**
     * Supply, Borrow Apr
     */
    const supplyApr = mul(mul(supplyRate, blocksInOneYear), 100);
    const borrowApr = mul(mul(borrowRate, blocksInOneYear), 100);

    /**
     * Collateral, Reserve Factor
     */
    const collateralFactor = mul(
      toFixed(divideDecimals(collateralFactorMantissa, 18)),
      100,
    );

    const reserveFactor = mul(
      toFixed(divideDecimals(reserveFactorMantissa, 18)),
      100,
    );

    await this.lendingService.repository.updateOneBy(
      {
        protocol: this.context.protocol,
        supplyToken,
        borrowToken,
        address,
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

  async getLendingInfos(): Promise<
    ({
      marketAddress: string;
      underlying: string;
      supplyRatePerBlock: BigNumber;
      borrowRatePerBlock: BigNumber;
      decimals: number;
      totalBorrows: BigNumber;
      totalReserves: BigNumber;
      reserveFactorMantissa: BigNumber;
      market: {
        isListed: boolean;
        collateralFactorMantissa: BigNumber;
        isVenus: boolean;
      };
    } | null)[]
  > {
    const marketAddresses = await this.context.getLendingAllMarkets();

    const lendingInfos = [];
    for await (const marketAddress of marketAddresses) {
      const info = await this.context.getLendingMarketInfos(marketAddress);
      lendingInfos.push({ marketAddress, ...info });
    }

    return lendingInfos;
  }

  async process(data: {
    lendingInfo: {
      marketAddress: string;
      underlying: string;
      supplyRatePerBlock: BigNumber;
      borrowRatePerBlock: BigNumber;
      decimals: number;
      totalBorrows: BigNumber;
      totalReserves: BigNumber;
      reserveFactorMantissa: BigNumber;
      market: {
        isListed: boolean;
        collateralFactorMantissa: BigNumber;
        isVenus: boolean;
      };
    } | null;
  }): Promise<Record<string, any>> {
    let queryRunner: QueryRunner | null = null;

    try {
      const { lendingInfo } = data;

      const {
        marketAddress,
        underlying,
        supplyRatePerBlock,
        borrowRatePerBlock,
        totalBorrows,
        totalReserves,
        reserveFactorMantissa,
        market: { isListed, collateralFactorMantissa },
      } = lendingInfo;

      const lendingMarketToken = await this.tokenService.repository.findOneBy({
        network: this.context.network,
        address: underlying,
        status: true,
      });

      if (isUndefined(lendingMarketToken)) {
        return { success: true };
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
        }
        return { success: true };
      }

      queryRunner = await this.handlerService.transaction.startTransaction();

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

      await this.handlerService.transaction.commitTransaction(queryRunner);
      return { success: true };
    } catch (e) {
      await this.handlerService.transaction.rollbackTransaction(queryRunner);

      const wrappedError = this.handlerService.wrappedError(e);

      // 인터널 노말 에러 시
      if (wrappedError.level === EXCEPTION_LEVEL.NORMAL) {
        return { success: false };
      }

      // 인터널 패닉 에러 시
      throw Error(e);
    } finally {
      await this.handlerService.transaction.releaseTransaction(queryRunner);
    }
  }
}
