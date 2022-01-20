import { EXCEPTION_LEVEL } from './exception.constant';

export class Exception extends Error {
  public readonly code: string;
  public readonly level: EXCEPTION_LEVEL;

  constructor(code: string, level: EXCEPTION_LEVEL = EXCEPTION_LEVEL.NORMAL) {
    super(code);
    this.code = code;
    this.level = level;
    Error.captureStackTrace(this);
  }
}
