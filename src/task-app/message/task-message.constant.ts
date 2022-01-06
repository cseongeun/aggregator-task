export enum TASK_MESSAGE {
  SUCCESS = 'task success',
  WARN = 'task warn',
  ERROR = 'task panic',

  INITIAL_START = 'task start initial',
  RESTART_MANUALLY = 'task restart manually',
  STOP_MANUALLY = 'task stop manually',
  CHANGE_CRON_MANUALLY = 'task changed cron manually',

  LISTENER_EXCEPTION = 'task listener exception',
}
