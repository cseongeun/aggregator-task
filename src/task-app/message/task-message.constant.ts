export enum TASK_MESSAGE {
  SUCCESS = 'task success',
  WARN = 'task warn',
  ERROR = 'task panic',

  INITIAL_START = 'task start initial',
  RESTART_MANUALLY = 'task restart manually',
  PANIC_STOP = 'task stop occur by panic',
  STOP_MANUALLY = 'task stop manually',
  CHANGE_CRON_MANUALLY = 'task changed cron manually',

  LISTENER_EXCEPTION = 'task listener exception',

  NOT_FOUND_TASK_SCRIPT = 'not found task script',
}
