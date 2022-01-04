import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';

(async () => {
  const App = await NestFactory.createApplicationContext(AppModule);

  // const logger = app.get<BaseLoggerService>(BaseLoggerService);
  // app.useLogger(logger);

  // const sentry = app.get<BaseSentryService>(BaseSentryService);
  // sentry.init(config.sentryDSN);

  const service = App.get<AppService>(AppService);
  service.start();
})();
