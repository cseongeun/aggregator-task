import { TASK_EXCEPTION_LEVEL } from './task-exception.constant';

export class Exception extends Error {
  public readonly code: string;
  public readonly level: TASK_EXCEPTION_LEVEL;

  constructor(
    code: string,
    level: TASK_EXCEPTION_LEVEL = TASK_EXCEPTION_LEVEL.NORMAL,
  ) {
    super(code);
    this.code = code;
    this.level = level;
    Error.captureStackTrace(this);
  }
}
