import { IsBoolean, IsDefined, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { CardSuit } from "src/shared/enums/game.enum";

export class RoomIdDto {
  @IsUUID('4', { message: '방 ID는 유효한 UUID v4 형식이어야 합니다.' })
  @IsString()
  @IsNotEmpty()
  roomId!: string;
}

export class JoinRoomDto extends RoomIdDto {}

/**
 * 단일 방 정책이어도
 * 재접속/상태복구/이벤트 명시성을 위해 roomId 유지한다.
 */
export class PlayCardDto extends RoomIdDto {
  @IsUUID('4', { message: '카드 ID는 유효한 UUID v4 형식이어야 합니다.' })
  @IsNotEmpty({ message: '낼 카드의 ID가 필요합니다.' })
  cardId!: string;

  @IsOptional()
  @IsEnum(CardSuit, { message: 'chosenSuit는 유효한 CardSuit여야 합니다.' })
  chosenSuit?: CardSuit;
}
