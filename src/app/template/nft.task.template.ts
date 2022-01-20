import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { QueryRunner } from 'typeorm';
import { NFTokenService } from '@seongeun/aggregator-base/lib/service';
import { BigNumber } from '@ethersproject/bignumber';
import { get } from '@seongeun/aggregator-util/lib/object';
import { NF_TOKEN_URI_TYPE } from '@seongeun/aggregator-base/lib/constant';
import { checkURI } from '@seongeun/aggregator-util/lib/regExp';
import { isNull, isUndefined } from '@seongeun/aggregator-util/lib/type';
import { fillSequenceNumber } from '@seongeun/aggregator-util/lib/array';
import {
  add,
  isGreaterThan,
  isGreaterThanOrEqual,
  sub,
} from '@seongeun/aggregator-util/lib/bignumber';
import { HandlerService } from '../handler/handler.service';
import { TaskBase } from '../../task.base';
import { EXCEPTION_CODE } from '../exception/exception.constant';

@Injectable()
export abstract class NFTTaskTemplate extends TaskBase {
  constructor(
    public readonly id: string,
    public readonly handlerService: HandlerService,
    public readonly nfTokenService: NFTokenService,
    public readonly context,
  ) {
    super(id, handlerService);
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

  /**
   * NFT 총 발행량 조회
   * @returns NFT 총 발행량
   */
  async getNetworkPid(): Promise<BigNumber> {
    return this.context.getNFTokenTotalSupply();
  }

  /**
   * 마지막으로 작업된 NFT 인덱스
   * @returns 마지막으로 작업된 NFT 인덱스
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
   * NFT 메타데이터 내 Image 또는 Animation 주소가 저장된 경로
   * @returns 경로
   */
  async getImageOrAnimationPath(): Promise<string> {
    const task = await this.handlerService.getTask(this.taskId);
    const path = get(task.config, 'path');

    if (isUndefined(path)) {
      throw Error(EXCEPTION_CODE.ERR2001);
    }

    return path;
  }

  /**
   * 진행
   * @param data  { totalPids: 작업 인덱스 모음, endPid: 마지막 인덱스, imageOrAnimationPath: 이미지 또는 애니매이션 주소가 저장된 경로}
   * @returns
   */
  async process(data: {
    totalPids: number[];
    endPid: number;
    imageOrAnimationPath: string;
  }): Promise<Record<string, any> | null> {
    let queryRunner: QueryRunner | null = null;
    try {
      const { totalPids, endPid, imageOrAnimationPath } = data;

      if (totalPids.length === 0) return;

      const nfTokenInfos = await this.context.getNFTokenInfos(totalPids);

      const createBulkData = [];

      for await (const nfTokenInfo of nfTokenInfos) {
        const { id, tokenURI } = nfTokenInfo;

        const data = {
          protocol: this.context.protocol,
          address: this.getNFTokenDetail().address,
          name: this.getNFTokenDetail().name || '',
          tokenId: id.toString(),
          uriType: NF_TOKEN_URI_TYPE.HTTP,
          tokenUri: tokenURI,
          tokenUriData: null,
          imageOrAnimationUri: null,
        };

        let requestUri = data.tokenUri;

        if (tokenURI.startsWith('ipfs://')) {
          data.uriType = NF_TOKEN_URI_TYPE.IPFS;
          const hash = tokenURI.replace('ipfs://', '');
          requestUri = `https://ipfs.io/ipfs/${hash}`;
        }
        const isValidURI = checkURI(requestUri);

        if (isValidURI) {
          try {
            data.tokenUriData = JSON.stringify(
              (await axios.get(requestUri)).data,
            );

            data.imageOrAnimationUri = get(
              JSON.parse(data.tokenUriData),
              imageOrAnimationPath,
            );
          } catch (e) {
            // nothing;
          }
        }

        createBulkData.push(data);
      }

      queryRunner = await this.handlerService.transaction.startTransaction();

      await this.nfTokenService.repository.createAllBy(
        createBulkData,
        queryRunner.manager,
      );

      await this.handlerService.updateTask(
        this.taskId,
        { pid: endPid },
        queryRunner.manager,
      );

      await this.handlerService.transaction.commitTransaction(queryRunner);
      return;
    } catch (e) {
      await this.handlerService.transaction.rollbackTransaction(queryRunner);

      throw Error(e);
    } finally {
      if (!isNull(queryRunner) && !queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }

  /**
   * 메인
   * @returns 로그
   */
  async run(): Promise<Record<string, any>> {
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

      await this.process({ totalPids, endPid, imageOrAnimationPath });

      return log;
    } catch (e) {
      throw Error(e);
    }
  }
}
