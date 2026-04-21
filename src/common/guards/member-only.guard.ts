import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { SocketData } from 'socket.io';

@Injectable()
export class MemberOnlyGuard implements CanActivate {
  private readonly logger = new Logger(MemberOnlyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const user: SocketData['user'] = client.data.user;

    // 인증 체크
    if (!user) {
      this.logger.warn('[Guard] Unauthorized access');
      throw new WsException('Unauthorized');
    }

    // 회원 여부 체크
    if (user.isGuest) {
      this.logger.warn(
        `[Guard] Guest user ${user.userId} tried to access member-only action`,
      );
      throw new WsException('Only registered users can perform this action');
    }

    return true;
  }
}