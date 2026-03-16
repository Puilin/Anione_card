import { v4 as uuidv4, validate as isUuid } from 'uuid';
import { SocketAuthMiddleware } from './auth.middleware';

describe('SocketAuthMiddleware', () => {
  let mockAuthService: any;
  let mockSocket: any;
  let next: jest.Mock;

  beforeEach(() => {
    // AuthService의 최소 기능을 모방하는 Mock 객체
    mockAuthService = {
      verifyToken: jest.fn(),
      generateToken: jest.fn(),
    };

    // 소켓 객체 모방
    mockSocket = {
      handshake: {
        auth: {},
        headers: {},
      },
      data: {},
    };

    next = jest.fn();
  });

  it('토큰이 없는 경우 새로운 토큰을 생성해야 한다', async () => {
    mockAuthService.generateToken.mockResolvedValue({ accessToken: 'new-token-123' });

    const middleware = SocketAuthMiddleware(mockAuthService);
    await middleware(mockSocket, next);

    expect(mockAuthService.generateToken).toHaveBeenCalled();
    expect(mockSocket.data.user.accessToken).toBe('new-token-123');
  });

  it('토큰과 UID가 없는 경우 새로운 UUID를 생성해야 한다', async () => {
    mockAuthService.generateToken.mockResolvedValue({ accessToken: 'new-token-123' });

    const middleware = SocketAuthMiddleware(mockAuthService);
    await middleware(mockSocket, next);

    expect(isUuid(mockSocket.data.user.userId)).toBe(true);
    expect(mockSocket.data.user.isGuest).toBe(true);
  });

  it('유효한 토큰이 있다면 해당 유저의 ID를 유지해야 한다', async () => {
    const existingUid = '550e8400-e29b-41d4-a716-446655440000';
    mockSocket.handshake.auth.token = 'valid-jwt-token';
    
    // 토큰 검증 시 기존 UID가 든 페이로드 반환하도록 설정
    mockAuthService.verifyToken.mockResolvedValue({ sub: existingUid });

    const middleware = SocketAuthMiddleware(mockAuthService);
    await middleware(mockSocket, next);

    expect(mockSocket.data.user.userId).toBe(existingUid);
    expect(mockAuthService.generateToken).not.toHaveBeenCalled(); // 재발급하지 않음
    expect(next).toHaveBeenCalledWith(); // 에러 없이 통과
  });
});