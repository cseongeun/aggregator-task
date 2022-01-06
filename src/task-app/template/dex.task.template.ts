import { BigNumber } from '@ethersproject/bignumber';
import { Injectable } from '@nestjs/common';
import {
  EntityManager,
  getConnection,
  In,
  QueryRunner,
  TransactionManager,
} from 'typeorm';
import { TokenService } from '@seongeun/aggregator-base/lib/service';
import {
  fillSequenceNumber,
  removeStringValues,
} from '@seongeun/aggregator-util/lib/array';
import {
  add,
  isGreaterThan,
  isGreaterThanOrEqual,
  sub,
} from '@seongeun/aggregator-util/lib/bignumber';
import { get } from '@seongeun/aggregator-util/lib/object';
import { isUndefined } from '@seongeun/aggregator-util/lib/type';
import {
  isZeroAddress,
  toCheckSumAddress,
} from '@seongeun/aggregator-util/lib/address';
import {
  getBatchCheckCA,
  getBatchERC20TokenInfos,
  getBatchPairInfos,
  getSafeERC20TokenInfo,
  getSafePairInfos,
} from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import {
  UNKNOWN_STRING,
  UNKNOWN_UINT256,
  ZERO_ADDRESS,
} from '@seongeun/aggregator-util/lib/constant';
import { TOKEN_TYPE } from '@seongeun/aggregator-base/lib/constant';
import { getPairTokenSymbol } from '@seongeun/aggregator-util/lib/naming';
import { TaskBase } from '../../task.base';
import { TaskHandlerService } from '../handler/task-handler.service';

@Injectable()
export abstract class DexTaskTemplate extends TaskBase {
  constructor(
    public readonly id: string,
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly context,
  ) {
    super(id, taskHandlerService);
  }

  loggingForm(): Record<string, any> {
    return {
      total: 0,
      start: 0,
      end: 0,
    };
  }

  async getNetworkPid(): Promise<BigNumber> {
    return this.context.getDexFactoryTotalLength();
  }

  async getLatestWorkedPid(): Promise<number> {
    const task = await this.taskHandlerService.getTask(this.taskId);
    return task?.pid || 0;
  }

  async getChunkSize(): Promise<number> {
    const task = await this.taskHandlerService.getTask(this.taskId);
    return parseInt(get(task.config, 'chunk'), 10) || 10;
  }

  grouping(pairInfos: any[]): {
    uniqueMultiTokenAddresses: string[];
    uniqueSingleTokenAddresses: string[];
  } {
    const multi = [];
    const single = [];

    pairInfos.forEach(({ pair, token0, token1 }) => {
      multi.push(pair);
      single.push(token0);
      single.push(token1);
    });

    return {
      uniqueMultiTokenAddresses: [...new Set(multi)],
      uniqueSingleTokenAddresses: [...new Set(single)],
    };
  }

  async removeRegisteredTokens(
    multiTokenAddresses: string[],
    singleTokenAddresses: string[],
  ): Promise<{
    newMultiTokenAddresses: string[];
    newSingleTokenAddresses: string[];
  }> {
    const [registeredMultiTokens, registeredSingleTokens] = await Promise.all([
      this.tokenService.repository.findAllBy({
        network: this.context.network,
        address: In(multiTokenAddresses),
      }),
      this.tokenService.repository.findAllBy({
        network: this.context.network,
        address: In(singleTokenAddresses),
      }),
    ]);

    const [registeredMultiTokenAddresses, registeredSingleTokenAddresses] = [
      registeredMultiTokens.map(({ address }) => address),
      registeredSingleTokens.map(({ address }) => address),
    ];

    const [newMultiTokenAddresses, newSingleTokenAddresses] = [
      removeStringValues(multiTokenAddresses, registeredMultiTokenAddresses),
      removeStringValues(singleTokenAddresses, registeredSingleTokenAddresses),
    ];

    return { newMultiTokenAddresses, newSingleTokenAddresses };
  }

  async removeInvalidTokens(
    multiTokenAddresses: string[],
    singleTokenAddresses: string[],
  ): Promise<{
    validMultiTokenAddresses: string[];
    validSingleTokenAddresses: string[];
    invalidSingleTokenAddresses: string[];
  }> {
    // remove same multi token in single position
    singleTokenAddresses = removeStringValues(
      singleTokenAddresses,
      multiTokenAddresses,
    );

    singleTokenAddresses = singleTokenAddresses.map((address) =>
      toCheckSumAddress(address),
    );

    const singleTokenCheckCA = await getBatchCheckCA(
      this.context.provider,
      this.context.multiCallAddress,
      singleTokenAddresses,
    );

    const invalidSingleTokenAddresses = [];

    const validSingleTokenAddresses = singleTokenAddresses.filter(
      (address: string, index: number) => {
        if (!singleTokenCheckCA[index]) {
          invalidSingleTokenAddresses.push(address);
        }

        return singleTokenCheckCA[index];
      },
    );

    return {
      validMultiTokenAddresses: multiTokenAddresses,
      validSingleTokenAddresses,
      invalidSingleTokenAddresses,
    };
  }

  async checkMultiTokenInSinglePosition(
    multiTokenAddresses: string[],
    singleTokenAddresses: string[],
    invalidSingleTokenAddresses: string[],
  ): Promise<{
    pureMultiTokenAddresses: string[];
    pureSingleTokenAddresses: string[];
    pureInvalidSingleTokenAddresses: string[];
  }> {
    let checkMultiInfos = [];
    try {
      checkMultiInfos = await getBatchPairInfos(
        this.context.provider,
        this.context.multiCallAddress,
        singleTokenAddresses,
      );
    } catch (e) {
      checkMultiInfos = await Promise.all(
        singleTokenAddresses.map(async (address) => {
          try {
            return getSafePairInfos(
              this.context.provider,
              this.context.multiCallAddress,
              address,
            );
          } catch (e) {
            return {
              pair: address,
              token0: ZERO_ADDRESS,
              token1: ZERO_ADDRESS,
              weird: true,
            };
          }
        }),
      );
    }

    const pureSingleTokenAddresses = [];

    checkMultiInfos.map(
      async (infos: {
        pair: string;
        token0: string;
        token1: string;
        weird?: boolean;
      }) => {
        const { pair, token0, token1, weird } = infos;

        // weird token, (case1, Infinite loop when calling name, etc)
        if (weird) {
          invalidSingleTokenAddresses.push(pair);
        }

        // pure single
        else if (isZeroAddress(token0) && isZeroAddress(token1)) {
          pureSingleTokenAddresses.push(pair);
        }

        // multi token in single position
        else {
          invalidSingleTokenAddresses.push(pair);
        }
      },
    );

    return {
      pureMultiTokenAddresses: multiTokenAddresses,
      pureSingleTokenAddresses,
      pureInvalidSingleTokenAddresses: invalidSingleTokenAddresses,
    };
  }

  async getTokenInfos(
    multiTokenAddresses: string[],
    singleTokenAddresses: string[],
  ): Promise<{ multiTokenInfos; singleTokenInfos }> {
    let multiTokenInfos = [];
    let singleTokenInfos = [];

    try {
      multiTokenInfos = await getBatchERC20TokenInfos(
        this.context.provider,
        this.context.multiCallAddress,
        multiTokenAddresses,
      );
    } catch (e) {
      const allSettled = await Promise.allSettled(
        multiTokenAddresses.map(async (address) => {
          return getSafeERC20TokenInfo(
            this.context.provider,
            this.context.multiCallAddress,
            address,
          );
        }),
      );

      multiTokenInfos = allSettled.map((result) => {
        const { status } = result;
        if (status === 'fulfilled') {
          return {
            name: result.value.name,
            symbol: result.value.symbol,
            decimals: result.value.decimals,
          };
        } else {
          return {
            name: UNKNOWN_STRING,
            symbol: UNKNOWN_STRING,
            decimals: UNKNOWN_UINT256,
          };
        }
      });
    }

    try {
      singleTokenInfos = await getBatchERC20TokenInfos(
        this.context.provider,
        this.context.multiCallAddress,
        singleTokenAddresses,
      );
    } catch (e) {
      const allSettled = await Promise.allSettled(
        singleTokenAddresses.map(async (address) => {
          return getSafeERC20TokenInfo(
            this.context.provider,
            this.context.multiCallAddress,
            address,
          );
        }),
      );
      singleTokenInfos = allSettled.map((result) => {
        const { status } = result;
        if (status === 'fulfilled') {
          return {
            name: result.value.name,
            symbol: result.value.symbol,
            decimals: result.value.decimals,
          };
        } else {
          return {
            name: UNKNOWN_STRING,
            symbol: UNKNOWN_STRING,
            decimals: UNKNOWN_UINT256,
          };
        }
      });
    }

    return { multiTokenInfos, singleTokenInfos };
  }

  async createSingleTokens(
    singleTokenAddresses: string[],
    singleTokenInfos: any,
    @TransactionManager() manager: EntityManager,
  ): Promise<void> {
    const singleTokenBulkParams = singleTokenAddresses.map(
      (address: string, index: number) => {
        const { name, symbol, decimals } = singleTokenInfos[index];

        return {
          network: this.context.network,
          type: TOKEN_TYPE.SINGLE,
          address,
          name,
          symbol,
          decimals: decimals.toString(),
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
    multiTokenAddresses: string[],
    multiTokenInfos: any,
    multiTokenComposed: any,
    invalidSingleTokenAddresses: string[],
    @TransactionManager() manager: EntityManager,
  ): Promise<void> {
    const multiTokenBulkParams = [];
    const multiTokenInSameChunk = [];

    await Promise.all(
      multiTokenAddresses.map(async (address: string, index: number) => {
        const { name, symbol, decimals } = multiTokenInfos[index];

        const { token0, token1 } = multiTokenComposed.find(
          (info: any) => info.pair.toLowerCase() === address.toLowerCase(),
        );

        const hasInvalidComposed = invalidSingleTokenAddresses.some(
          (address: string) => address === token0 || address === token1,
        );
        if (hasInvalidComposed) return;

        const [registeredToken0, registeredToken1] = await Promise.all([
          this.tokenService.repository.findOneBy(
            { network: this.context.network, address: token0 },
            manager,
          ),
          this.tokenService.repository.findOneBy(
            { network: this.context.network, address: token1 },
            manager,
          ),
        ]);

        if (isUndefined(registeredToken0) || isUndefined(registeredToken1)) {
          multiTokenInSameChunk.push({
            address,
            name,
            symbol,
            decimals,
            token0,
            token1,
          });
        } else {
          if (registeredToken0.status && registeredToken1.status) {
            multiTokenBulkParams.push({
              network: this.context.network,
              type: TOKEN_TYPE.MULTI,
              address,
              name,
              symbol: getPairTokenSymbol(registeredToken0, registeredToken1),
              decimals: decimals.toString(),
              pair0: registeredToken0,
              pair1: registeredToken1,
              status: name !== UNKNOWN_STRING && symbol !== UNKNOWN_STRING,
            });
          }
        }
      }),
    );

    await this.tokenService.repository.createAllIfNotExistBy(
      multiTokenBulkParams,
      manager,
    );

    if (multiTokenInSameChunk.length > 0) {
      const multiTokenInSameChunkBulkParams = [];
      await Promise.all(
        multiTokenInSameChunk.map(
          async ({ address, name, symbol, decimals, token0, token1 }) => {
            const [registeredToken0, registeredToken1] = await Promise.all([
              this.tokenService.repository.findOneBy(
                { network: this.context.network, address: token0 },
                manager,
              ),
              this.tokenService.repository.findOneBy(
                { network: this.context.network, address: token1 },
                manager,
              ),
            ]);

            if (registeredToken0?.status && registeredToken1?.status) {
              multiTokenInSameChunkBulkParams.push({
                network: this.context.network,
                type: TOKEN_TYPE.MULTI,
                address,
                name,
                symbol: getPairTokenSymbol(registeredToken0, registeredToken1),
                decimals: decimals.toString(),
                pair0: registeredToken0,
                pair1: registeredToken1,
                status: name !== UNKNOWN_STRING && symbol !== UNKNOWN_STRING,
              });
            }
          },
        ),
      );

      await this.tokenService.repository.createAllIfNotExistBy(
        multiTokenInSameChunkBulkParams,
        manager,
      );
    }
  }

  async getPairsInfo(multiTokens: string[]) {
    return getBatchPairInfos(
      this.context.provider,
      this.context.multiCallAddress,
      multiTokens,
    );
  }

  async process(data: {
    totalPids: number[];
    endPid: number;
  }): Promise<Record<string, any> | null> {
    let queryRunner: QueryRunner | null = null;
    try {
      const { totalPids, endPid } = data;

      if (totalPids.length === 0) return;

      const multiTokenAddresses = await this.context.getDexFactoryInfos(
        totalPids,
      );

      const multiTokenComposed = await this.getPairsInfo(multiTokenAddresses);

      const { uniqueMultiTokenAddresses, uniqueSingleTokenAddresses } =
        this.grouping(multiTokenComposed);

      const { newMultiTokenAddresses, newSingleTokenAddresses } =
        await this.removeRegisteredTokens(
          uniqueMultiTokenAddresses,
          uniqueSingleTokenAddresses,
        );

      const {
        validMultiTokenAddresses,
        validSingleTokenAddresses,
        invalidSingleTokenAddresses,
      } = await this.removeInvalidTokens(
        newMultiTokenAddresses,
        newSingleTokenAddresses,
      );

      const {
        pureMultiTokenAddresses,
        pureSingleTokenAddresses,
        pureInvalidSingleTokenAddresses,
      } = await this.checkMultiTokenInSinglePosition(
        validMultiTokenAddresses,
        validSingleTokenAddresses,
        invalidSingleTokenAddresses,
      );

      const { multiTokenInfos, singleTokenInfos } = await this.getTokenInfos(
        pureMultiTokenAddresses,
        pureSingleTokenAddresses,
      );

      queryRunner = await getConnection().createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      if (pureSingleTokenAddresses.length > 0)
        await this.createSingleTokens(
          pureSingleTokenAddresses,
          singleTokenInfos,
          queryRunner.manager,
        );

      if (pureMultiTokenAddresses.length > 0)
        await this.createMultiTokens(
          pureMultiTokenAddresses,
          multiTokenInfos,
          multiTokenComposed,
          pureInvalidSingleTokenAddresses,
          queryRunner.manager,
        );

      await this.taskHandlerService.updateTask(
        this.taskId,
        { pid: endPid },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
      return {};
    } catch (e) {}
  }

  async run(): Promise<Record<string, any>> {
    const log = this.loggingForm();

    try {
      const [networkPid, workedPid, chunkSize] = await Promise.all([
        this.getNetworkPid(),
        this.getLatestWorkedPid(),
        this.getChunkSize(),
      ]);
      console.log('here');

      const startPid = workedPid;
      let endPid = networkPid.toNumber();

      if (isGreaterThanOrEqual(startPid, endPid)) return;

      if (isGreaterThan(sub(endPid, startPid), chunkSize)) {
        endPid = add(startPid, chunkSize).toNumber();
      }

      log.total = networkPid.toNumber();
      log.start = startPid;
      log.end = endPid;

      const totalPids = fillSequenceNumber(
        parseInt(sub(endPid, startPid).toString(), 10),
        startPid,
      );

      await this.process({ totalPids, endPid });

      return log;
    } catch (e) {
      throw Error(e);
    }
  }
}
