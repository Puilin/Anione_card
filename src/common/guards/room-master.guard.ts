import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { RoomService } from 'src/modules/socket/room.service';
import { SocketData } from 'socket.io';

@Injectable()
export class RoomMasterGuard implements CanActivate {
  private readonly logger = new Logger(RoomMasterGuard.name);

  constructor(
    private readonly roomService: RoomService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const user: SocketData['user'] = client.data.user;

    // ParticipantGuard 이후라 가정 → 최소 체크만 수행
    const room = client.data.room;

    if (room!.hostId !== user.userId) {
      this.logger.warn(
        `[RoomMasterGuard] User ${user.userId} is not host of room ${room!.roomId}`,
      );
      throw new WsException('Only host can perform this action');
    }

    return true;
  }
}