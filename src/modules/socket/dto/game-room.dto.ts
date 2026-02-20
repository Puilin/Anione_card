import { IsBoolean, IsDefined, IsNotEmpty, IsString, IsUUID } from "class-validator";

export class RoomIdDto {
  @IsUUID('4', { message: '방 ID는 유효한 UUID v4 형식이어야 합니다.' })
  @IsString()
  @IsNotEmpty()
  roomId: string;
}

export class JoinRoomDto extends RoomIdDto {}
export class LeaveRoomDto extends RoomIdDto {}
export class GameReadyDto extends RoomIdDto {
  @IsBoolean({ message: '준비 상태는 true 또는 false여야 합니다.' })
  @IsDefined({ message: '준비 상태(isReady) 값은 필수입니다.' }) // IsEmpty는 false도 빈 값으로 간주하므로 IsDefined로 변경
  isReady: boolean;
}

export class PlayCardDto extends RoomIdDto {
  @IsUUID('4', { message: '카드 ID는 유효한 UUID v4 형식이어야 합니다.' })
  @IsNotEmpty({ message: '낼 카드의 ID가 필요합니다.' })
  cardId: string;
}