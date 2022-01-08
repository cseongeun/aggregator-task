import { Injectable } from '@nestjs/common';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import {
  EntityManager,
  getConnection,
  In,
  QueryRunner,
  TransactionManager,
} from 'typeorm';
import { TaskHandlerService } from '../../task-app/handler/task-handler.service';
import { TaskBase } from '../../task.base';
import { TerraSwapTerraSchedulerService } from '@seongeun/aggregator-defi-protocol/lib/terra-swap/terra/terra-swap.terra.scheduler.service';
import { TASK_ID } from '../../task-app.constant';
import { DexTaskTemplate } from '../../task-app/template/dex.task.template';
import { get } from '@seongeun/aggregator-util/lib/object';
import { TOKEN_TYPE } from '@seongeun/aggregator-base/lib/constant';
import { UNKNOWN_STRING } from '@seongeun/aggregator-util/lib/constant';
import { isUndefined } from '@seongeun/aggregator-util/lib/type';
import { getPairTokenSymbol } from '@seongeun/aggregator-util/lib/naming';
import { getBatchCW20TokenInfos } from '@seongeun/aggregator-util/lib/multicall/cosmwasm-contract';

@Injectable()
export class TerraSwapTerraDexTask extends TaskBase {
  loggingForm(): Record<string, any> {
    throw new Error('Method not implemented.');
  }
  process(data: any): Promise<Record<string, any>> {
    throw new Error('Method not implemented.');
  }
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context: TerraSwapTerraSchedulerService,
  ) {
    super(TASK_ID.TERRA_SWAP_TERRA_DEX, taskHandlerService);
  }

  async getLatestAssetInfo(): Promise<any> {
    const task = await this.taskHandlerService.getTask(this.taskId);
    return get(JSON.parse(task.data), 'latestAsset') || null;
  }

  async createSingleTokens(
    singleInfo: { address; name; symbol; decimals; total_supply }[],
    @TransactionManager() manager: EntityManager,
  ) {
    const singleTokenBulkParams = singleInfo.map(
      ({
        address,
        name,
        symbol,
        decimals,
        total_supply,
      }: {
        address: string;
        name: string;
        symbol: string;
        decimals: number;
        total_supply: string;
      }) => {
        return {
          network: this.context.network,
          type: TOKEN_TYPE.SINGLE,
          address,
          name,
          symbol,
          decimals: decimals,
          totalSupply: total_supply.toString(),
          status: name !== UNKNOWN_STRING && symbol !== UNKNOWN_STRING,
        };
      },
    );

    await this.tokenService.repository.createAllIfNotExistBy(
      singleTokenBulkParams,
      manager,
    );
  }

  async createMultiTokens(
    multiInfo: any,
    composedInfo: any[],
    @TransactionManager() manager: EntityManager,
  ) {
    const multiTokenBulkParams = [];

    await Promise.all(
      multiInfo.map(
        async ({
          address,
          name,
          symbol,
          decimals,
          total_supply,
        }: {
          address: string;
          name: string;
          symbol: string;
          decimals: number;
          total_supply: string;
        }) => {
          const targetComposed = composedInfo.find(
            ({ multiTokenAddress }) => multiTokenAddress === address,
          );

          if (targetComposed) {
            const { pair0TokenAddress, pair1TokenAddress } = targetComposed;
            const [registeredPair0Token, registeredPair1Token] =
              await Promise.all([
                this.tokenService.repository.findOneBy(
                  {
                    network: this.context.network,
                    type: In([TOKEN_TYPE.SINGLE, TOKEN_TYPE.NATIVE]),
                    address: pair0TokenAddress,
                  },
                  manager,
                ),
                this.tokenService.repository.findOneBy(
                  {
                    network: this.context.network,
                    type: In([TOKEN_TYPE.SINGLE, TOKEN_TYPE.NATIVE]),
                    address: pair1TokenAddress,
                  },
                  manager,
                ),
              ]);

            if (
              !isUndefined(registeredPair0Token) &&
              !isUndefined(registeredPair1Token)
            ) {
              multiTokenBulkParams.push({
                network: this.context.network,
                type: TOKEN_TYPE.MULTI,
                address,
                name,
                symbol: getPairTokenSymbol(
                  registeredPair0Token,
                  registeredPair1Token,
                ),
                decimals: decimals.toString(),
                pair0: registeredPair0Token,
                pair1: registeredPair1Token,
                totalSupply: total_supply.toString(),
                status: name !== UNKNOWN_STRING && symbol !== UNKNOWN_STRING,
              });
            }
          }
        },
      ),
    );

    await this.tokenService.repository.createAllIfNotExistBy(
      multiTokenBulkParams,
      manager,
    );
  }

  async doTask(pairs: any, @TransactionManager() manager: EntityManager) {
    const composedInfo = [];
    const multi = [];
    const single = [];

    for await (const asset of pairs) {
      const { asset_infos, liquidity_token } = asset;

      // for multi
      const multiTokenAddress = liquidity_token;
      multi.push(multiTokenAddress);

      let pair0TokenAddress;
      let pair1TokenAddress;

      for (const [index, info] of asset_infos.entries()) {
        const hasSingleToken = info.hasOwnProperty('token');
        const hasNativeToken = info.hasOwnProperty('native_token');

        let targetToken;

        if (hasSingleToken) {
          targetToken = info.token.contract_addr;
          single.push(targetToken);
        }

        if (hasNativeToken) {
          targetToken = info.native_token.denom;
        }

        if (index == 0) {
          pair0TokenAddress = targetToken;
        }

        if (index == 1) {
          pair1TokenAddress = targetToken;
        }
      }

      composedInfo.push({
        multiTokenAddress,
        pair0TokenAddress,
        pair1TokenAddress,
      });
    }

    const [singleInfo, multiInfo] = await Promise.all([
      getBatchCW20TokenInfos(
        this.context.provider,
        this.context.multiCallAddress,
        single,
      ),
      getBatchCW20TokenInfos(
        this.context.provider,
        this.context.multiCallAddress,
        multi,
      ),
    ]);

    await this.createSingleTokens(singleInfo, manager);
    await this.createMultiTokens(multiInfo, composedInfo, manager);
  }

  async run(l): Promise<void> {
    let queryRunner: QueryRunner | null = null;

    try {
      const latestAsset = await this.latestAssetInfo();

      const factoryInfos = await this.context.getDEXFactoryInfos(latestAsset);
      const pairs = factoryInfos.pairs;

      queryRunner = await getConnection().createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      await this.doTask(pairs, queryRunner.manager);

      if (factoryInfos.length > 0) {
        const latest = pairs[pairs.length - 1];
        await this.schedulerService.updateScheduler(
          {
            id: this.id,
          },
          { data: JSON.stringify({ latestAsset: latest.asset_infos }) },
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();
      return;
    } catch (e) {
      console.log(e);
      if (!isNull(queryRunner)) {
        await queryRunner.rollbackTransaction();
      }
      this.errorHandler(e);
    } finally {
      if (!isNull(queryRunner) && !queryRunner?.isReleased) {
        await queryRunner.release();
      }
    }
  }
}
