import { Injectable } from '@nestjs/common';
import { WinstonLoggerService } from '@seongeun/aggregator-logger';

@Injectable()
export class TaskLoggerService {
  id = 'UNKNOWN_TASK';
  label = `[${this.id}]`;

  constructor(private readonly winstonLoggerService: WinstonLoggerService) {}

  injectId(id: string): void {
    this.id = id;
  }

  log(data: {
    message?: string;
    work?: Record<string, any>;
    elapsedTime?: string;
  }): void {
    this.winstonLoggerService.log(this._format('log', data));
  }

  warn(data: { message?: string; errorMessage?: string; stack?: any }): void {
    this.winstonLoggerService.warn(this._format('warn', data));
  }

  error(data: { message?: string; errorMessage?: string; stack?: any }): void {
    this.winstonLoggerService.error(this._format('error', data));
  }

  private _format(
    type = 'log',
    data: {
      message?: string;
      work?: any;
      stack?: any;
      errorMessage?: string;
      elapsedTime?: string;
    },
  ) {
    const res: any = {
      id: this.id,
      message: data.message,
    };

    switch (type) {
      case 'log': {
        res.work = JSON.stringify(data.work);
        res.elapsedTime = data.elapsedTime;
        break;
      }

      case 'warn': {
        res.errorMessage = data.errorMessage;
        res.stack = JSON.stringify(data.stack);
        break;
      }

      case 'error': {
        res.errorMessage = data.errorMessage;
        res.stack = JSON.stringify(data.stack);
        break;
      }
    }

    return JSON.stringify(res);
  }
}
