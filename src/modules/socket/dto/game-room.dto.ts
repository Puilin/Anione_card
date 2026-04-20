import { IsBoolean, IsDefined, IsNotEmpty, IsString, IsUUID } from "class-validator";

export class RoomIdDto {
  @IsUUID('4', { message: '방 ID는 유효한 UUID v4 형식이어야 합니다.' })
  @IsString()
  @IsNotEmpty()
  roomId!: string;
}

export class JoinRoomDto extends RoomIdDto {}
export class LeaveRoomDto extends RoomIdDto {}

export class PlayCardDto extends RoomIdDto {
  @IsUUID('4', { message: '카드 ID는 유효한 UUID v4 형식이어야 합니다.' })
  @IsNotEmpty({ message: '낼 카드의 ID가 필요합니다.' })
  cardId!: string;
}