import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { SocketData } from 'socket.io';
import { RoomService } from 'src/modules/socket/room.service';

@Injectable()
export class GameParticipantGuard implements CanActivate {
  private readonly logger = new Logger(GameParticipantGuard.name);

  constructor(
    private readonly roomService: RoomService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const user: SocketData['user'] = client.data.user;

    // 인증 체크
    if (!user) {
      this.logger.warn('[Guard] Unauthorized access');
      throw new WsException('Unauthorized');
    }

    // 유저가 속한 방 조회 (서버 기준)
    const roomId = this.roomService.getUserRoom(user.userId);
    if (!roomId) {
      this.logger.warn(`[Guard] User ${user.userId} is not in any room`);
      throw new WsException('User is not in any room');
    }

    // 방 존재 여부
    const room = this.roomService.getRoom(roomId);
    if (!room) {
      this.logger.warn(`[Guard] Room ${roomId} not found`);
      throw new WsException('Room not found');
    }

    // 실제 참여자 검증
    const isParticipant = room.players.some(
      (p) => p.userId === user.userId,
    );

    if (!isParticipant) {
      this.logger.warn(
        `[Guard] User ${user.userId} is not a participant of room ${roomId}`,
      );
      throw new WsException('User is not a participant');
    }

    client.data.room = room;

    return true;
  }
}