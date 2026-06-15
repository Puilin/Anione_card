import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GameGateway } from "./game.gateway";
import { RoomService } from "./room.service";
import { GameSetupService } from "../game/game-setup.service";
import { GameService } from "../game/game.service";
import { MaskingService } from "./masking.service";
import { GameResponseInterceptor } from "./interceptors/game-response.interceptor";
import { ActionValidatorRegistry } from "../game/validators/action-validator.registry";
import { ACTION_VALIDATORS } from "../game/validators/action-validator.token";
import { AttackCardValidator } from "../game/validators/attack-card-action.validator";
import { NormalCardValidator } from "../game/validators/normal-card-action.validator";
import { SkipCardValidator } from "../game/validators/skip-card-action.validator";
import { ReverseCardValidator } from "../game/validators/reverse-card-action.validator";
import { ShieldCardValidator } from "../game/validators/shield-card-action.validator";
import { EvadeCardValidator } from "../game/validators/evade-card-action.validator";
import { BonusCardValidator } from "../game/validators/bonus-card-action.validator";
import { WildcardActionValidator } from "../game/validators/wildcard-action.validator";
import { TurnManagerService } from "../game/turn-manager.service";
import { GAME_ACTION_EXECUTOR, GAME_ACTION_QUEUE } from "../game/actions/game-action.token";
import { GameActionExecutorService } from "../game/actions/game-action-executor.service";
import { InMemoryGameActionQueue } from "../game/actions/in-memory-game-action-queue.service";

@Module({
  imports: [AuthModule],
  providers: [
    GameGateway,
    RoomService,
    GameService,
    GameSetupService,
    MaskingService,
    GameResponseInterceptor,
    ActionValidatorRegistry,
    AttackCardValidator,
    NormalCardValidator,
    SkipCardValidator,
    ReverseCardValidator,
    ShieldCardValidator,
    EvadeCardValidator,
    BonusCardValidator,
    WildcardActionValidator,
    TurnManagerService,
    GameActionExecutorService,
    InMemoryGameActionQueue,
    {
      provide: GAME_ACTION_EXECUTOR,
      useExisting: GameActionExecutorService,
    },
    {
      provide: GAME_ACTION_QUEUE,
      useExisting: InMemoryGameActionQueue,
    },
    {
      provide: ACTION_VALIDATORS,
      useFactory: (
        attack: AttackCardValidator,
        normal: NormalCardValidator,
        skip: SkipCardValidator,
        reverse: ReverseCardValidator,
        shield: ShieldCardValidator,
        evade: EvadeCardValidator,
        bonus: BonusCardValidator,
        wildcard: WildcardActionValidator,
      ) => [
        attack,
        normal,
        skip,
        reverse,
        shield,
        evade,
        bonus,
        wildcard,
      ],
      inject: [
        AttackCardValidator,
        NormalCardValidator,
        SkipCardValidator,
        ReverseCardValidator,
        ShieldCardValidator,
        EvadeCardValidator,
        BonusCardValidator,
        WildcardActionValidator,
      ],
    },
  ],
  exports: [MaskingService],
})
export class GameModule {}
