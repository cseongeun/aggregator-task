import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { getConnection, QueryRunner } from 'typeorm';
import { NFTokenService } from '@seongeun/aggregator-base/lib/service';
import { BigNumber } from '@ethersproject/bignumber';
import { get } from '@seongeun/aggregator-util/lib/object';
import { NF_TOKEN_URI_TYPE } from '@seongeun/aggregator-base/lib/constant';
import { checkURI } from '@seongeun/aggregator-util/lib/regExp';
import { isNull } from '@seongeun/aggregator-util/lib/type';
import { fillSequenceNumber } from '@seongeun/aggregator-util/lib/array';
import {
  add,
  isGreaterThan,
  isGreaterThanOrEqual,
  sub,
} from '@seongeun/aggregator-util/lib/bignumber';
import { TaskHandlerService } from '../handler/task-handler.service';
import { TaskBase } from '../../task.base';

@Injectable()
export abstract class NFTTaskTemplate extends TaskBase {
  constructor(
    public id: string,
    public readonly taskHandlerService: TaskHandlerService,
    public readonly nfTokenService: NFTokenService,
    public readonly context,
  ) {
    super(id, taskHandlerService);
  }

  // NFT 컨트랙트 정보
  abstract getNFTokenDetail(): { name: string; address: string };

  loggingForm(): Record<string, any> {
    return {
      total: 0,
      start: 0,
      end: 0,
    };
  }

  async getNetworkPid(): Promise<BigNumber> {
    return this.context.getNFTokenTotalSupply();
  }

  async getLatestWorkedPid(): Promise<number> {
    const task = await this.taskHandlerService.getTask(this.taskId);
    return task?.pid || 0;
  }

  async getChunkSize(): Promise<number> {
    const task = await this.taskHandlerService.getTask(this.taskId);
    return parseInt(get(task.config, 'chunk'), 10) || 110;
  }

  async getImageOrAnimationPath(): Promise<string> {
    const task = await this.taskHandlerService.getTask(this.taskId);
    return get(task.config, 'path');
  }

  async process(data: {
    nfTokenInfo: { id: BigNumber; tokenURI: string };
    imageOrAnimationPath: string;
  }): Promise<Record<string, any>> {
    try {
      const {
        nfTokenInfo: { id, tokenURI },
        imageOrAnimationPath,
      } = data;

      const createParams = {
        protocol: this.context.protocol,
        address: this.getNFTokenDetail().address,
        name: this.getNFTokenDetail().name || '',
        tokenId: id.toString(),
        uriType: NF_TOKEN_URI_TYPE.HTTP,
        tokenUri: tokenURI,
        tokenUriData: null,
        imageOrAnimationUri: null,
      };

      let requestUri = createParams.tokenUri;

      if (tokenURI.startsWith('ipfs:://')) {
        createParams.uriType = NF_TOKEN_URI_TYPE.IPFS;
        const hash = tokenURI.replace('ipfs://', '');
        requestUri = `https://ipfs.io/ipfs/${hash}`;
      }
      const isValidURI = checkURI(requestUri);

      if (isValidURI) {
        try {
          createParams.tokenUriData = JSON.stringify(
            (await axios.get(requestUri)).data,
          );

          createParams.imageOrAnimationUri = get(
            JSON.parse(createParams.tokenUriData),
            imageOrAnimationPath,
          );
        } catch (e) {
          // nothing;
        }
      }

      return { params: createParams };
    } catch (e) {
      throw Error(e);
    }
  }

  async run(): Promise<Record<string, any>> {
    let queryRunner: QueryRunner | null = null;

    const log = this.loggingForm();

    try {
      const [networkPid, workedPid, chunkSize, imageOrAnimationPath] =
        await Promise.all([
          this.getNetworkPid(),
          this.getLatestWorkedPid(),
          this.getChunkSize(),
          this.getImageOrAnimationPath(),
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

      const totalPids: number[] = fillSequenceNumber(
        sub(endPid, startPid).toNumber(),
        startPid,
      );

      const nfTokenInfos = await this.context.getNFTokenInfos(totalPids);

      const createBulkParams = [];
      for await (const nfTokenInfo of nfTokenInfos) {
        const { params } = await this.process({
          nfTokenInfo,
          imageOrAnimationPath,
        });

        createBulkParams.push(params);
      }

      queryRunner = await getConnection().createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      await this.nfTokenService.repository.createAllBy(
        createBulkParams,
        queryRunner.manager,
      );
      await this.taskHandlerService.updateTask(
        this.taskId,
        { pid: endPid },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();
      return log;
    } catch (e) {
      if (!isNull(queryRunner)) {
        await queryRunner.rollbackTransaction();
      }

      throw Error(e);
    } finally {
      if (!isNull(queryRunner) && !queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }
}
