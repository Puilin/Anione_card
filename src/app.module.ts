import { Module } from '@nestjs/common';
import { GameGateway } from './modules/socket/game.gateway';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { GameModule } from './modules/socket/game.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 앱 전체에서 ConfigService를 쓸 수 있게 함
      envFilePath: '.env',
    }),
    AuthModule,
    GameModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
