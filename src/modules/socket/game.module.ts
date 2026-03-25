import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GameGateway } from "./game.gateway";
import { RoomService } from "./room.service";
import { GameSetupService } from "../game/game-setup.service";
import { GameService } from "../game/game.service";

@Module({
  imports: [AuthModule],
  providers: [
    GameGateway,
    RoomService,
    GameService,
    GameSetupService
  ],
  exports: [],
})
export class GameModule {}