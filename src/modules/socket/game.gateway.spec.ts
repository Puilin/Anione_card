import { createMock } from '@golevelup/ts-jest';
import { GUARDS_METADATA, INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { WsException } from '@nestjs/websockets';
import { MESSAGE_MAPPING_METADATA, MESSAGE_METADATA } from '@nestjs/websockets/constants';
import { Server, Socket } from 'socket.io';

import { AuthService } from '../auth/auth.service';
import { GameService } from '../game/game.service';
import { SocketEvent } from 'src/shared/enums/socket-event.enum';
import { RoomService } from './room.service';
import { GameGateway } from './game.gateway';
import { GameRoom } from 'src/shared/interfaces/game.interface';
import { CardSuit, CardType, GameDirection } from 'src/shared/enums/game.enum';
import { SocketData } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GameParticipantGuard } from 'src/common/guards/game-participant.guard';
import { TurnOwnerGuard } from 'src/common/guards/turnowner.guard';
import { GameResponseInterceptor } from './interceptors/game-response.interceptor';
import { TurnManagerService } from '../game/turn-manager.service';
import { GameActionQueue } from '../game/actions/game-action-queue.interface';
import { GameActionType } from 'src/shared/enums/game-action-type.enum';

describe('GameGateway', () => {
  let gateway: GameGateway;
  let authService: jest.Mocked<AuthService>;
  let roomService: jest.Mocked<RoomService>;
  let gameService: jest.Mocked<GameService>;
  let gameActionQueue: jest.Mocked<GameActionQueue>;

  beforeEach(() => {
    authService = createMock<AuthService>();
    roomService = createMock<RoomService>();
    gameService = createMock<GameService>();
    gameActionQueue = createMock<GameActionQueue>();

    gateway = new GameGateway(
      authService,
      roomService,
      gameService,
      gameActionQueue,
    );
  });

  describe('handlePlayCard', () => {
    it('playCard 이벤트에서 Queue에 액션을 enqueue하고 후조회한 room을 반환해야 한다', async () => {
      const client = {
        data: {
          user: {
            userId: 'user-1',
            nickname: 'tester',
            isGuest: false,
          },
        },
      } as Socket;

      const updatedRoom: Partial<GameRoom> = {
        roomId: 'room-1',
        lastCard: {
          id: 'card-1',
          type: CardType.NUMBER,
          power: 0,
          suit: CardSuit.RABBIT,
          declaredSuit: CardSuit.RABBIT,
          value: '3',
          assetKey: 'rabbit_3',
        }
      };

      gameActionQueue.enqueue.mockResolvedValue(undefined);
      roomService.getRoom.mockReturnValue(
        updatedRoom as GameRoom,
      );

      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({
        emit,
      });

      gateway.server = { to } as unknown as Server;

      const result = await gateway.handlePlayCard(
        client,
        {
          roomId: 'room-1',
          cardId: 'card-1',
          expectedActionId: 0,
        },
      );

      expect(gameActionQueue.enqueue).toHaveBeenCalledWith(
        {
          type: GameActionType.PLAY_CARD,
          roomId: 'room-1',
          userId: 'user-1',
          expectedActionId: 0,
          cardId: 'card-1',
          chosenSuit: undefined,
        },
      );
      expect(to).toHaveBeenCalledWith(
        'room-1',
      );
      expect(emit).toHaveBeenCalledWith(
        SocketEvent.GAME_STATE_UPDATE,
        {
          message: `${client.data.user.nickname}님이 [${updatedRoom.lastCard?.suit} ${updatedRoom.lastCard?.value}] 카드를 냈습니다.`,
        }
      );
      expect(result).toBe(updatedRoom);
    });

    it('Queue에서 발생한 예외를 그대로 전파해야 한다', async () => {
      const client = {
        data: {
          user: {
            userId: 'user-1',
            nickname: 'tester',
            isGuest: false,
          },
        },
      } as Socket;

      gameActionQueue.enqueue.mockRejectedValue(
        new WsException('play card failed'),
      );

      gateway.server = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      } as unknown as Server;

      await expect(
        gateway.handlePlayCard(
          client,
          {
            roomId: 'room-1',
            cardId: 'card-1',
            expectedActionId: 0,
          },
        ),
      ).rejects.toThrow(WsException);
    });
  });

  describe('handleDrawCard', () => {
    it('drawCard 이벤트에서 Queue에 액션을 enqueue하고 후조회한 room을 반환해야 한다', async () => {
      const client = {
        data: {
          user: {
            userId: 'user-1',
            nickname: 'tester',
            isGuest: false,
          },
        },
      } as Socket;

      const updatedRoom: Partial<GameRoom> = {
        roomId: 'room-1',
      };

      gameActionQueue.enqueue.mockResolvedValue(undefined);
      roomService.getRoom.mockReturnValue(
        updatedRoom as GameRoom,
      );

      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({
        emit,
      });

      gateway.server = { to } as unknown as Server;

      const result = await gateway.handleDrawCard(
        client,
        {
          roomId: 'room-1',
          expectedActionId: 0,
        },
      );

      expect(gameActionQueue.enqueue).toHaveBeenCalledWith(
        {
          type: GameActionType.DRAW_CARD,
          roomId: 'room-1',
          userId: 'user-1',
          expectedActionId: 0,
        },
      );
      expect(to).toHaveBeenCalledWith(
        'room-1',
      );
      expect(emit).toHaveBeenCalledWith(
        SocketEvent.GAME_STATE_UPDATE,
        {
          message: `${client.data.user.nickname}님이 카드를 한 장 뽑았습니다.`,
        },
      );
      expect(result).toBe(updatedRoom);
    });

    it('Queue에서 발생한 예외를 그대로 전파해야 한다', async () => {
      const client = {
        data: {
          user: {
            userId: 'user-1',
            nickname: 'tester',
            isGuest: false,
          },
        },
      } as Socket;

      gameActionQueue.enqueue.mockRejectedValue(
        new WsException('draw card failed'),
      );

      gateway.server = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      } as unknown as Server;

      await expect(
        gateway.handleDrawCard(
          client,
          {
            roomId: 'room-1',
            expectedActionId: 0,
          },
        ),
      ).rejects.toThrow(WsException);
    });

    it('payload roomId와 expectedActionId를 Queue 액션으로 전달해야 한다', async () => {
      const client = {
        data: {
          user: {
            userId: 'user-1',
            nickname: 'tester',
            isGuest: false,
          },
        },
      } as Socket;

      gameActionQueue.enqueue.mockResolvedValue(undefined);
      roomService.getRoom.mockReturnValue({
        roomId: 'room-other',
      } as GameRoom);

      gateway.server = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      } as unknown as Server;

      await gateway.handleDrawCard(
        client,
        {
          roomId: 'room-other',
          expectedActionId: 3,
        },
      );

      expect(gameActionQueue.enqueue).toHaveBeenCalledWith({
        type: GameActionType.DRAW_CARD,
        roomId: 'room-other',
        userId: 'user-1',
        expectedActionId: 3,
      });
    });

    it('GameParticipantGuard와 TurnOwnerGuard, GameResponseInterceptor가 적용되어야 한다', () => {
      const handler = GameGateway.prototype.handleDrawCard;

      expect(
        Reflect.getMetadata(MESSAGE_MAPPING_METADATA, handler),
      ).toBe(true);
      expect(
        Reflect.getMetadata(MESSAGE_METADATA, handler),
      ).toBe(SocketEvent.DRAW_CARD);
      expect(
        Reflect.getMetadata(GUARDS_METADATA, handler),
      ).toEqual([
        GameParticipantGuard,
        TurnOwnerGuard,
      ]);
      expect(
        Reflect.getMetadata(INTERCEPTORS_METADATA, handler),
      ).toEqual([
        GameResponseInterceptor,
      ]);
    });
  });
});

describe('GameGateway disconnect cleanup', () => {
  let gateway: GameGateway;
  let authService: jest.Mocked<AuthService>;
  let gameService: jest.Mocked<GameService>;
  let roomService: RoomService;
  let turnManager: jest.Mocked<TurnManagerService>;

  beforeEach(() => {
    authService = createMock<AuthService>();
    gameService = createMock<GameService>();
    turnManager = createMock<TurnManagerService>();
    roomService = new RoomService(turnManager);
    gameActionQueue = createMock<GameActionQueue>();

    gateway = new GameGateway(
      authService,
      roomService,
      gameService,
      gameActionQueue,
    );

    gateway.server = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as unknown as Server;
  });

  it('disconnect 시 players 목록에서 제거되어야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);
    roomService.joinRoom(room.roomId, guest);

    gateway.handleDisconnect(createClient(guest));

    const updatedRoom = roomService.getRoom(room.roomId);
    expect(updatedRoom?.players.some((player) => player.userId === guest.userId)).toBe(false);
  });

  it('disconnect 시 userToRoom 인덱스가 제거되어야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);
    roomService.joinRoom(room.roomId, guest);

    gateway.handleDisconnect(createClient(guest));

    expect(roomService.getUserRoom(guest.userId)).toBeUndefined();
  });

  it('방장 disconnect 시 host가 다른 플레이어에게 이관되어야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);
    roomService.joinRoom(room.roomId, guest);

    gateway.handleDisconnect(createClient(host));

    const updatedRoom = roomService.getRoom(room.roomId);
    expect(updatedRoom?.hostId).toBe(guest.userId);
  });

  it('턴 오너 disconnect 시 다음 턴 유저에게 턴이 넘어가야 한다', () => {
    const host = mockUser(false);
    const guest1 = mockUser();
    const guest2 = mockUser();
    const room = roomService.createRoom(host);

    turnManager.resolveTurnAfterLeave.mockReturnValue(
      guest1.userId,
    );

    roomService.joinRoom(room.roomId, guest1);
    roomService.joinRoom(room.roomId, guest2);

    room.status = 'PLAYING';
    room.direction = GameDirection.CLOCKWISE;
    room.turnOwner = host.userId;

    gateway.handleDisconnect(createClient(host));

    const updatedRoom = roomService.getRoom(room.roomId);
    expect(updatedRoom?.turnOwner).toBe(guest1.userId);
  });

  it('마지막 유저 disconnect 시 방이 삭제되어야 한다', () => {
    const host = mockUser(false);
    const room = roomService.createRoom(host);

    gateway.handleDisconnect(createClient(host));

    expect(roomService.getRoom(room.roomId)).toBeUndefined();
  });

  it('disconnect 후 재접속 시 already in a room 오류 없이 다시 입장할 수 있어야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);

    roomService.joinRoom(room.roomId, guest);
    gateway.handleDisconnect(createClient(guest));

    expect(() => {
      roomService.joinRoom(room.roomId, guest);
    }).not.toThrow(WsException);

    const updatedRoom = roomService.getRoom(room.roomId);
    expect(updatedRoom?.players.some((player) => player.userId === guest.userId)).toBe(true);
  });
});

function createClient(user: SocketData['user']): Socket {
  return {
    id: uuidv4(),
    data: { user, room: undefined },
  } as Socket;
}

function mockUser(isGuest = true): SocketData['user'] {
  const userId = uuidv4();

  return {
    userId,
    nickname: `${isGuest ? 'Guest' : 'User'}_${userId.slice(0, 4)}`,
    isGuest,
  };
}
