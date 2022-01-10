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
import { get } from '@seongeun/aggregator-util/lib/object';
import { TOKEN_TYPE } from '@seongeun/aggregator-base/lib/constant';
import { UNKNOWN_STRING } from '@seongeun/aggregator-util/lib/constant';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import { getPairTokenSymbol } from '@seongeun/aggregator-util/lib/naming';
import { getBatchCW20TokenInfos } from '@seongeun/aggregator-util/lib/multicall/cosmwasm-contract';

@Injectable()
export class TerraSwapTerraDexTask extends TaskBase {
  constructor(
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context: TerraSwapTerraSchedulerService,
  ) {
    super(TASK_ID.TERRA_SWAP_TERRA_DEX, taskHandlerService);
  }

  loggingForm(): Record<string, any> {
    return {
      newSingleToken: 0,
      newMultiToken: 0,
    };
  }

  async getLatestAssetInfo(): Promise<any> {
    const task = await this.taskHandlerService.getTask(this.taskId);
    return get(task.data, 'latestAsset') || null;
  }

  async createSingleTokens(
    singleInfo: { address; name; symbol; decimals; total_supply }[],
    @TransactionManager() manager: EntityManager,
  ): Promise<{ numOfNewSingle: number }> {
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

    return { numOfNewSingle: singleTokenBulkParams.length };
  }

  async createMultiTokens(
    multiInfo: any,
    composedInfo: any[],
    @TransactionManager() manager: EntityManager,
  ): Promise<{ numOfNewMulti: number }> {
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

    return { numOfNewMulti: multiTokenBulkParams.length };
  }

  async process(data: {
    pairs: any;
  }): Promise<{ single: number; multi: number }> {
    let queryRunner: QueryRunner | null = null;

    try {
      const { pairs } = data;

      const composedInfo = [];
      const multi = [];
      const single = [];

      for await (const asset of pairs) {
        const { asset_infos, liquidity_token } = asset;

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

      queryRunner =
        await this.taskHandlerService.transaction.startTransaction();

      const { numOfNewSingle } = await this.createSingleTokens(
        singleInfo,
        queryRunner.manager,
      );

      const { numOfNewMulti } = await this.createMultiTokens(
        multiInfo,
        composedInfo,
        queryRunner.manager,
      );

      if (pairs.length > 0) {
        const latestAsset = pairs[pairs.length - 1];
        await this.taskHandlerService.updateTask(
          this.taskId,
          {
            data: { latestAsset: latestAsset.asset_infos },
          },
          queryRunner.manager,
        );
      }
      await this.taskHandlerService.transaction.commitTransaction(queryRunner);

      return {
        single: numOfNewSingle,
        multi: numOfNewMulti,
      };
    } catch (e) {
      await this.taskHandlerService.transaction.rollbackTransaction(
        queryRunner,
      );
      throw Error(e);
    } finally {
      await this.taskHandlerService.transaction.releaseTransaction(queryRunner);
    }
  }

  async run(): Promise<Record<string, any>> {
    const log = this.loggingForm();

    try {
      const latestAsset = await this.getLatestAssetInfo();

      const factoryInfos = await this.context.getDexFactoryInfos(latestAsset);

      const pairs = factoryInfos.pairs;
      /**
       * [
       *  {
       *       asset_infos: [
       *         { native_token: { denom: "uusd" } },
       *         {
       *           token: {
       *             contract_addr: "terra1qqfx5jph0rsmkur2zgzyqnfucra45rtjae5vh6",
       *           },
       *         },
       *       ],
       *       contract_addr: "terra1a5cc08jt5knh0yx64pg6dtym4c4l8t63rhlag3",
       *       liquidity_token: "terra1veqh8yc55mhw0ttjr5h6g9a6r9nylmrc0nzhr7",
       *   },
       *   ...
       * ]
       */
      if (pairs.length === 0) return;

      const { single, multi } = await this.process({ pairs });

      log.newSingleToken = single;
      log.newMultiToken = multi;

      return log;
    } catch (e) {
      throw Error(e);
    }
  }
}
