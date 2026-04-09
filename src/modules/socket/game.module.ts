import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GameGateway } from "./game.gateway";
import { RoomService } from "./room.service";
import { GameSetupService } from "../game/game-setup.service";
import { GameService } from "../game/game.service";
import { MaskingService } from "./masking.service";
import { GameResponseInterceptor } from "./interceptors/game-response.interceptor";

@Module({
  imports: [AuthModule],
  providers: [
    GameGateway,
    RoomService,
    GameService,
    GameSetupService,
    MaskingService,
    GameResponseInterceptor
  ],
  exports: [MaskingService],
})
export class GameModule {}