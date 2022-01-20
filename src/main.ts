import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';

(async () => {
  const TaskApp = await NestFactory.createApplicationContext(AppModule);

  const service = TaskApp.get<AppService>(AppService);
  service.start();
})();
