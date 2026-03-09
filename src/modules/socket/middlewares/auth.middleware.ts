import { Socket, SocketData } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '../../auth/auth.service';
import { UserSession } from 'src/shared/interfaces/user-session.interface';
import { Logger } from '@nestjs/common';

export type SocketMiddleware = (socket: Socket<any, any, any, SocketData>, next: (err?: Error) => void) => void;

const logger = new Logger('SocketAuthMiddleware');

export const SocketAuthMiddleware = (authService: AuthService): SocketMiddleware => {
  return async (socket, next) => {
    try {
      // 토큰 추출 (auth 또는 headers에서 Bearer 토큰 확인)
      const token = extractToken(socket);
      
      let userId: string | null = null;
      let isGuest = true;
      let newAccessToken: string | null = null;

      // 토큰이 있으면 검증 시도
      if (token) {
        try {
          const payload = await authService.verifyToken(token);
          if (payload && payload.sub) {
            userId = payload.sub;
            isGuest = false; // TODO: 추후 DB 연동 시 회원 비회원 구분 로직 보완
          }
        } catch (error) {
          // 토큰이 있지만 변조되었거나 만료된 경우
          logger.warn(`유효하지 않은 토큰: ${socket.handshake.address}. 게스트로 전환합니다`);
        }
      }

      // userId가 없으면 생성
      if (!userId) {
        userId = uuidv4();
        isGuest = true;
      }

      // 신규 유저거나 토큰이 없었던 경우 토큰 생성 (테스트 항목 1번 대응)
      // userId가 새로 생성됐거나, 기존에 토큰이 없어서 넘어온 경우 모두 포함
      if (!token || isGuest) {
        const result = await authService.generateToken(userId);
        newAccessToken = result.accessToken;
      }

      const session: UserSession = {
        userId,
        nickname: generateNickname(userId, isGuest),
        isGuest,
        ip: socket.handshake.address,
        connectedAt: Date.now(),
        accessToken: newAccessToken || token || undefined,
      }

      // 소켓 세션에 유저 정보 저장
      socket.data.user = session;

      logger.log(`${socket.data.user.nickname} connected from ${socket.handshake.address}`);

      next();
    } catch (error) {
      const authError = new Error('Authentication Failed');
      (authError as any).data = { code: 'AUTH_ERROR', message: error.message };
      next(authError);
    }
  };
};

function extractToken(socket: Socket): string | undefined {
  // Socket.io 전용 인증 객체
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }

  // HTTP 표준 헤더 (Postman 등 범용 툴 대응)
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader) {
    return authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : authHeader;
  }

  return undefined;
}

function generateNickname(userId: string, isGuest: boolean): string {
  const prefix = isGuest ? 'Guest' : 'User';
  return `${prefix}_${userId.substring(0, 4)}`;
}