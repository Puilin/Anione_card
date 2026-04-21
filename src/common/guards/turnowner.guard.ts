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
export class TurnOwnerGuard implements CanActivate {
  private readonly logger = new Logger(TurnOwnerGuard.name);

  constructor(
    private readonly roomService: RoomService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const user = client.data.user;

    // ParticipantGuard 이후라 가정 → 최소 체크만 수행
    const room = client.data.room;

    if (room!.turnOwner !== user.userId) {
      this.logger.warn(
        `[TurnOwnerGuard] User ${user.userId} is not turn owner`,
      );
      throw new WsException('Not your turn');
    }

    return true;
  }
}