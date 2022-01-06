import { Injectable } from '@nestjs/common';
import { WinstonLoggerService } from '@seongeun/aggregator-logger';

@Injectable()
export class TaskLogger {
  constructor(private readonly winstonLoggerService: WinstonLoggerService) {}

  log(
    label: string,
    data: {
      message?: string;
      work?: Record<string, any>;
      elapsedTime?: string;
    },
  ): void {
    this.winstonLoggerService.log(this._format('log', label, data));
  }

  warn(
    label: string,
    data: { message?: string; errorMessage?: string; stack?: any },
  ): void {
    this.winstonLoggerService.warn(this._format('warn', label, data));
  }

  error(
    label: string,
    data: { message?: string; errorMessage?: string; stack?: any; extra?: any },
  ): void {
    this.winstonLoggerService.error(this._format('error', label, data));
  }

  private _format(
    type = 'log',
    label: string,
    data: {
      message?: string;
      work?: any;
      stack?: any;
      errorMessage?: string;
      elapsedTime?: string;
      extra?: string;
    },
  ) {
    const res: any = {
      id: label,
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
        res.extra = JSON.stringify(data.extra);
        break;
      }
    }

    return JSON.stringify(res);
  }
}
