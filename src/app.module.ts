import { Module } from '@nestjs/common';
import { GameGateway } from './modules/socket/game.gateway';

@Module({
  imports: [],
  controllers: [],
  providers: [GameGateway],
})
export class AppModule {}
