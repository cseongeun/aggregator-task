import { NestFactory } from '@nestjs/core';
import { TaskAppModule } from './task-app.module';
import { TaskAppService } from './task-app.service';

(async () => {
  const taskApp = await NestFactory.createApplicationContext(TaskAppModule);

  // const logger = app.get<BaseLoggerService>(BaseLoggerService);
  // app.useLogger(logger);

  // const sentry = app.get<BaseSentryService>(BaseSentryService);
  // sentry.init(config.sentryDSN);

  const taskAppService = taskApp.get<TaskAppService>(TaskAppService);
  taskAppService.start();
})();
