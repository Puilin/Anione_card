import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // DTO에 없는 속성 제거
    transform: true,        // 타입을 DTO 클래스로 자동 변환
  }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
