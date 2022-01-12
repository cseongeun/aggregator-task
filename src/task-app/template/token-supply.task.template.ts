import { Injectable } from '@nestjs/common';
import {
  NETWORK_CHAIN_ID,
  NETWORK_CHAIN_TYPE,
} from '@seongeun/aggregator-base/lib/constant';
import { Network, Token } from '@seongeun/aggregator-base/lib/entity';
import {
  NetworkService,
  TokenService,
} from '@seongeun/aggregator-base/lib/service';
import { toSplitWithChunkSize, zip } from '@seongeun/aggregator-util/lib/array';
import { getBatchERC20TotalSupply } from '@seongeun/aggregator-util/lib/multicall/evm-contract';
import { get } from '@seongeun/aggregator-util/lib/object';
import { TaskBase } from '../../task.base';
import { TaskHandlerService } from '../handler/task-handler.service';
import { Provider } from '@ethersproject/providers';
import { retryWrap } from '@seongeun/aggregator-util/lib/retry-wrapper';
import { TASK_EXCEPTION_LEVEL } from '../exception/task-exception.constant';
import { divideDecimals } from '@seongeun/aggregator-util/lib/decimals';
import {
  isGreaterThan,
  sub,
  toBigNumber,
} from '@seongeun/aggregator-util/lib/bignumber';
import BigNumberJs from 'bignumber.js';

@Injectable()
export abstract class TokenSupplyTaskTemplate extends TaskBase {
  network: Network;

  constructor(
    public readonly id: string,
    public readonly chainType: NETWORK_CHAIN_TYPE,
    public readonly chainId: NETWORK_CHAIN_ID,
    public readonly taskHandlerService: TaskHandlerService,
    public readonly tokenService: TokenService,
    public readonly networkService: NetworkService,
  ) {
    super(id, taskHandlerService);
  }

  async getNetworkTokens(): Promise<Token[]> {
    return this.tokenService.repository.findAllBy({
      network: this.network,
      status: true,
    });
  }

  loggingForm(): { total: number; success: number; warn: number } {
    return {
      total: 0,
      success: 0,
      warn: 0,
    };
  }

  async onModuleInit(): Promise<void> {
    super.onModuleInit();

    this.network = await this.networkService.repository.findOneBy({
      chainType: this.chainType,
      chainId: this.chainId,
    });
  }

  /**
   * 청크 사이즈 가져오기
   * @returns 청크 사이즈
   */
  async getChunkSize(): Promise<number> {
    const task = await this.taskHandlerService.getTask(this.taskId);
    return parseInt(get(task.config, 'chunk'), 10) || 100;
  }

  async getTokenWithTotalSupplyZip(tokens: Token[]) {
    const tokenAddresses = tokens.map((token: Token) => token.address);

    const tokenTotalSupplies = await retryWrap(
      getBatchERC20TotalSupply(
        this.networkService.provider(this.network.chainKey) as Provider,
        this.networkService.multiCallAddress(this.network.chainKey),
        tokenAddresses,
      ),
    );

    return zip(tokens, tokenTotalSupplies);
  }

  /**
   * 저장 가능 Decimals을 넘었는지 확인 (decimals(65, 22))
   * @param totalSupply totalSupply (데시멀 반영되어있는 상태)
   * @returns boolean (길이 벗어남: true)
   */
  isOutOfRangeSupply(totalSupply: string): boolean {
    const precision = toBigNumber(totalSupply)
      .integerValue(BigNumberJs.ROUND_DOWN)
      .toString();
    const scale = sub(totalSupply, precision).toString().replace('0.', '');

    if (
      isGreaterThan(totalSupply.length, 65) ||
      isGreaterThan(precision.length, 43) ||
      isGreaterThan(scale.length, 21)
    ) {
      return true;
    }

    return false;
  }

  async process(data: { tokens: Token[] }): Promise<any> {
    try {
      const { tokens } = data;

      const tokenWithTotalSupplyZip = await this.getTokenWithTotalSupplyZip(
        tokens,
      );

      for await (const tokenWithTotalSupply of tokenWithTotalSupplyZip) {
        const [token, totalSupplyBigNumber] = tokenWithTotalSupply;

        const { id, decimals } = token;

        const totalSupply = divideDecimals(
          totalSupplyBigNumber,
          decimals,
        ).toString();

        const isOutOfRange = this.isOutOfRangeSupply(totalSupply);

        if (isOutOfRange) {
          continue;
        }

        await this.tokenService.repository.updateOneBy(
          {
            id,
          },
          {
            totalSupply,
          },
        );
      }
      return { success: true };
    } catch (e) {
      const wrappedError = this.taskHandlerService.wrappedError(e);

      // 인터널 노말 에러 시
      if (wrappedError.level === TASK_EXCEPTION_LEVEL.NORMAL) {
        return { success: false };
      }

      throw Error(e);
    }
  }

  /**
   * 메인
   */
  async run(): Promise<{ total: number; success: number; warn: number }> {
    const log = this.loggingForm();

    try {
      const [totalTokens, chunkSize] = await Promise.all([
        this.getNetworkTokens(),
        this.getChunkSize(),
      ]);

      const chunkTokens: Token[][] = toSplitWithChunkSize(
        totalTokens,
        chunkSize,
      );

      for await (const chunkToken of chunkTokens) {
        const { success } = await this.process({ tokens: chunkToken });

        if (success) {
          log.success += chunkToken.length;
          continue;
        }

        log.warn += chunkToken.length;
      }

      return log;
    } catch (e) {
      throw Error();
    }
  }
}
