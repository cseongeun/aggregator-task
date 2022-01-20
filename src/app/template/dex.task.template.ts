import { BigNumber } from '@ethersproject/bignumber';
import { Injectable } from '@nestjs/common';
import { EntityManager, In, QueryRunner, TransactionManager } from 'typeorm';
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
import { HandlerService } from '../handler/handler.service';

@Injectable()
export abstract class DexTaskTemplate extends TaskBase {
  constructor(
    public readonly id: string,
    public readonly handlerService: HandlerService,
    public readonly tokenService: TokenService,
    public readonly context,
  ) {
    super(id, handlerService);
  }

  // 로그 폼
  loggingForm(): Record<string, any> {
    return {
      total: 0,
      start: 0,
      end: 0,
    };
  }

  /**
   * 팩토리에서 생성된 페어 총 갯수 조회
   * @returns 페어 총 갯수
   */
  async getNetworkPid(): Promise<BigNumber> {
    return this.context.getDexFactoryTotalLength();
  }

  /**
   * 마지막으로 작업된 페어 인덱스
   * @returns 마지막으로 작업된 페어 인덱스
   */
  async getLatestWorkedPid(): Promise<number> {
    const task = await this.handlerService.getTask(this.taskId);
    return task?.pid || 0;
  }

  /**
   * 청크 사이즈
   * @returns 청크 사이즈
   */
  async getChunkSize(): Promise<number> {
    const task = await this.handlerService.getTask(this.taskId);
    return parseInt(get(task.config, 'chunk'), 10) || 10;
  }

  /**
   * 페어 정보를 멀티 토큰과와 싱글토큰으로 그룹핑
   * @param pairInfos { pair: 페어 주소, token0: 토큰 0 주소, token1: 토큰 1 주소 }
   * @returns { uniqueMultiTokenAddresses: 멀티 토큰 주소 모음(unique), uniqueSingleTokenAddresses: 유니크한 싱글 토큰 주소 모음(unique) }
   */
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

  /**
   * 이미 저장된 토큰 제거
   * @param multiTokenAddresses 멀티 토큰 주소 모음
   * @param singleTokenAddresses 싱글 토큰 주소 모음
   * @returns { newMultiTokenAddresses: 저장되지않은 신규 멀티 토큰 주소 모음, newSingleTokenAddresses: 저장되지않은 신규 싱글 토큰 주소 모음 }
   */
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

  /**
   * 유효하지않은 토큰 주소 제거
   * @param multiTokenAddresses 멀티 토큰 주소 모음
   * @param singleTokenAddresses 싱글 토큰 주소 모음
   * @returns { validMultiTokenAddresses: 유효한 멀티 토큰 주소 모음, validSingleTokenAddresses: 유효한 싱글 토큰 주소 모음, invalidSingleTokenAddresses: 유효하지않은 싱글 토큰 주소 모음 }
   */
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

  /**
   * 멀티 토큰 포지션에 존재하는 싱글 토큰 확인 후 싱글 토큰으로 이전
   * @param multiTokenAddresses 멀티 토큰 주소 모음
   * @param singleTokenAddresses 싱글 토큰 주소 모음
   * @param invalidSingleTokenAddresses 유효하지않은 싱글 토큰 주소 모음
   * @returns { pureMultiTokenAddresses: 완전한 멀티 토큰 주소 모음, pureSingleTokenAddresses: 완전한 싱글 토큰 주소 모음, pureInvalidSingleTokenAddresses: 완전한 유효하지않은 싱글 토큰 주소 모음 }
   */
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

  /**
   * 토큰 정보 가져오기
   * @param multiTokenAddresses 멀티 토큰 주소 모음
   * @param singleTokenAddresses 싱글 토큰 주소 모음
   * @returns { multiTokenInfos: 멀티 토큰 정보 모음, singleTokenInfos: 싱글 토큰 정보 모음 }
   */
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

  /**
   * 싱글 토큰 생성
   * @param singleTokenAddresses 싱글 토큰 주소 모음
   * @param singleTokenInfos 싱글 토큰 정보 모음
   * @param manager 트랜잭션 매니저
   */
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

  /**
   * 멀티 토큰 생성
   * @param multiTokenAddresses 멀티 토큰 주소 모음
   * @param multiTokenInfos 멀티 토큰 정보 모음
   * @param multiTokenComposed 멀티 토큰 구성 정보 모음
   * @param invalidSingleTokenAddresses 유효하지않은 싱글 토큰 주소 모음
   * @param manager 트랜잭션 매지너
   */
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

  /**
   * 멀티 토큰 구성 정보 가져오기
   * @param multiTokenAddresses 멀티 토큰 주소 모음
   * @returns 멀티 토큰 정보
   */
  async getPairsInfo(multiTokenAddresses: string[]): Promise<any[]> {
    return getBatchPairInfos(
      this.context.provider,
      this.context.multiCallAddress,
      multiTokenAddresses,
    );
  }

  /**
   * 진행
   * @param data { totalPids: 작업 인덱스 모음, endPid: 마지막 인덱스 }
   * @returns
   */
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

      queryRunner = await this.handlerService.transaction.startTransaction();

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

      await this.handlerService.updateTask(
        this.taskId,
        { pid: endPid },
        queryRunner.manager,
      );

      await this.handlerService.transaction.commitTransaction(queryRunner);
      return {};
    } catch (e) {
      await this.handlerService.transaction.rollbackTransaction(queryRunner);

      throw Error(e);
    } finally {
      await this.handlerService.transaction.releaseTransaction(queryRunner);
    }
  }

  /**
   * 메인
   * @returns 로그
   */
  async run(): Promise<Record<string, any>> {
    const log = this.loggingForm();

    try {
      const [networkPid, workedPid, chunkSize] = await Promise.all([
        this.getNetworkPid(),
        this.getLatestWorkedPid(),
        this.getChunkSize(),
      ]);

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
