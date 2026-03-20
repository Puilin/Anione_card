import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GameGateway } from "./game.gateway";
import { RoomService } from "./room.service";
import { GameSetupService } from "../game/game-setup.service";

@Module({
  imports: [AuthModule],
  providers: [
    GameGateway,
    RoomService,
    GameSetupService
  ],
  exports: [],
})
export class GameModule {}