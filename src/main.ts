import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from './config/validation.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<EnvConfig>);
  const port = configService.get('PORT', { infer: true })!;

  await app.listen(port, '0.0.0.0');
}
bootstrap();
