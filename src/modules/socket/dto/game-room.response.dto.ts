import { Exclude, Expose, Type } from 'class-transformer';
import { CardSuit, CardType, GameDirection } from 'src/shared/enums/game.enum';

@Exclude()
export class CardResponseDto {
  @Expose() id!: string;
  @Expose() suit!: CardSuit;
  @Expose() type!: CardType;
  @Expose() value!: string;
  @Expose() power!: number;
  @Expose() assetKey!: string;
}

@Exclude()
export class PlayerResponseDto {
  @Expose() userId!: string;
  @Expose() nickname!: string;
  @Expose() role!: 'PLAYER' | 'SPECTATOR';
  @Expose() cardCount!: number;
  @Expose() isOut!: boolean;
  
  @Expose()
  @Type(() => CardResponseDto)
  hand?: CardResponseDto[];
}

@Exclude()
export class GameRoomResponseDto {
  @Expose() roomId!: string;
  @Expose() turnOwner!: string | null;
  @Expose() isBonusTurn!: boolean;
  @Expose() direction!: GameDirection;
  @Expose() attackStack!: number;
  @Expose()
  @Type(() => GameLogResponseDto)
  recentLogs!: GameLogResponseDto[];

  @Expose()
  @Type(() => PlayerResponseDto)
  players!: PlayerResponseDto[];

  @Expose()
  @Type(() => CardResponseDto)
  lastCard!: CardResponseDto | null;

  // drawPile, discardPile 등은 
  // @Expose()가 없으므로 자동으로 제외됩니다. (보안성 확보)
}

@Exclude()
export class GameLogResponseDto {
  @Expose() id!: string;
  @Expose() type!: string;
  @Expose() actorId!: string;
  @Expose() actorName!: string;
  @Expose() targetId?: string;
  @Expose() cardId?: string;
  @Expose() payload?: Record<string, unknown>;
  @Expose() timestamp!: number;
}