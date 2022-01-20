import { Injectable } from '@nestjs/common';
import { WinstonLoggerService } from '@seongeun/aggregator-common';
import { COLOR } from '@seongeun/aggregator-util/lib/color';

@Injectable()
export class Logger {
  constructor(private readonly winstonLoggerService: WinstonLoggerService) {}

  log(
    label: string,
    data: {
      message?: string;
      work?: Record<string, any>;
      elapsedTime?: string;
    },
  ): void {
    const { saveMsg, consoleMsg } = this._formatLog('log', label, data);
    this.winstonLoggerService.log(saveMsg, consoleMsg);
  }

  warn(
    label: string,
    data: { message?: string; errorMessage?: string; stack?: any },
  ): void {
    const { saveMsg, consoleMsg } = this._formatLog('warn', label, data);
    this.winstonLoggerService.warn(saveMsg, consoleMsg);
  }

  error(
    label: string,
    data: { message?: string; errorMessage?: string; stack?: any; extra?: any },
  ): void {
    const { saveMsg, consoleMsg } = this._formatLog('error', label, data);
    this.winstonLoggerService.error(saveMsg, consoleMsg);
  }

  private _formatLog(
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

    const [protocol, network, taskType] = label.split('_');

    const saveMsg = JSON.stringify({ ...res, id: label });
    const consoleMsg = `[${COLOR.FgMagenta}${protocol}${COLOR.Reset}(${
      COLOR.FgBlue
    }${network}${COLOR.Reset}) ${COLOR.FgCyan}${taskType}${
      COLOR.Reset
    }] - ${JSON.stringify({ ...res })}`;

    return { saveMsg, consoleMsg };
  }
}
