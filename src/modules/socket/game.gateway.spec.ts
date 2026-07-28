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
import { CardSuit, CardType, GameDirection, GameStatus, WinReason } from 'src/shared/enums/game.enum';
import { SocketData } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GameParticipantGuard } from 'src/common/guards/game-participant.guard';
import { TurnOwnerGuard } from 'src/common/guards/turnowner.guard';
import { GameResponseInterceptor } from './interceptors/game-response.interceptor';
import { TurnManagerService } from '../game/turn-manager.service';
import { GameActionQueue } from '../game/actions/game-action-queue.interface';
import { GameActionType } from 'src/shared/enums/game-action-type.enum';
import { VictoryService } from '../game/victory.service';
import { RoomMasterGuard } from 'src/common/guards/room-master.guard';

describe('GameGateway', () => {
  let gateway: GameGateway;
  let authService: jest.Mocked<AuthService>;
  let roomService: jest.Mocked<RoomService>;
  let gameService: jest.Mocked<GameService>;
  let gameActionQueue: jest.Mocked<GameActionQueue>;
  let victoryService: jest.Mocked<VictoryService>;

  beforeEach(() => {
    authService = createMock<AuthService>();
    roomService = createMock<RoomService>();
    gameService = createMock<GameService>();
    gameActionQueue = createMock<GameActionQueue>();
    victoryService = createMock<VictoryService>();

    gateway = new GameGateway(
      authService,
      roomService,
      gameService,
      victoryService,
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
        status: GameStatus.PLAYING,
        winnerId: null,
        winReason: null,
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

    it('종료된 상태라면 GAME_OVER 이벤트도 전송해야 한다', async () => {
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
        status: GameStatus.FINISHED,
        winnerId: 'user-1',
        winReason: WinReason.EMPTY_HAND,
        lastCard: {
          id: 'card-1',
          type: CardType.NUMBER,
          power: 0,
          suit: CardSuit.RABBIT,
          declaredSuit: CardSuit.RABBIT,
          value: '3',
          assetKey: 'rabbit_3',
        },
      };

      gameActionQueue.enqueue.mockResolvedValue(undefined);
      roomService.getRoom.mockReturnValue(updatedRoom as GameRoom);

      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({
        emit,
      });

      gateway.server = { to } as unknown as Server;

      await gateway.handlePlayCard(
        client,
        {
          roomId: 'room-1',
          cardId: 'card-1',
          expectedActionId: 0,
        },
      );

      expect(emit).toHaveBeenNthCalledWith(
        1,
        SocketEvent.GAME_STATE_UPDATE,
        {
          message: `${client.data.user.nickname}님이 [${updatedRoom.lastCard?.suit} ${updatedRoom.lastCard?.value}] 카드를 냈습니다.`,
        },
      );
      expect(emit).toHaveBeenNthCalledWith(
        2,
        SocketEvent.GAME_OVER,
        {
          winnerId: 'user-1',
          winReason: WinReason.EMPTY_HAND,
          message: `${client.data.user.nickname}님이 승리했습니다.`,
        },
      );
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
        status: GameStatus.PLAYING,
        winnerId: null,
        winReason: null,
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

  describe('handleLeaveRoom', () => {
    it('명시적 퇴장 후 마지막 플레이어만 남으면 GAME_OVER를 전송해야 한다', () => {
      const room = {
        roomId: 'room-1',
        winnerId: 'winner-1',
        winReason: WinReason.PLAYER_LEAVE,
      } as GameRoom;
      const client = {
        data: {
          user: {
            userId: 'user-1',
            nickname: 'tester',
            isGuest: false,
          },
        },
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
        leave: jest.fn(),
      } as unknown as Socket;

      roomService.leaveRoom.mockReturnValue({
        room,
        roomId: 'room-1',
        isDeleted: false,
      });
      victoryService.determineWinner.mockReturnValue({
        winner: {
          userId: 'winner-1',
          nickname: 'winner',
          isGuest: false,
          hand: [],
          cardCount: 0,
          isReady: true,
          isConnected: true,
          disconnectedAt: null,
          isOut: false,
          role: 'PLAYER',
        },
        reason: WinReason.PLAYER_LEAVE,
      });

      const emit = jest.fn();
      gateway.server = {
        to: jest.fn().mockReturnValue({
          emit,
        }),
      } as unknown as Server;

      gateway.handleLeaveRoom(client);

      expect(victoryService.determineWinner).toHaveBeenCalledWith({
        room,
        trigger: 'PLAYER_LEFT',
        actorId: 'user-1',
      });
      expect(gameService.finishGame).toHaveBeenCalled();
      expect(emit).toHaveBeenCalledWith(
        SocketEvent.GAME_OVER,
        {
          winnerId: 'winner-1',
          winReason: WinReason.PLAYER_LEAVE,
          message: 'winner님이 마지막 플레이어로 남아 승리했습니다.',
        },
      );
    });
  });

  describe('handleJoinRoom', () => {
    it('FINISHED 상태에 입장한 관전자에게 결과 관전 메시지를 브로드캐스트해야 한다', () => {
      const client = {
        data: {
          user: {
            userId: 'user-2',
            nickname: 'guest',
            isGuest: true,
          },
        },
        join: jest.fn(),
      } as unknown as Socket;

      roomService.joinRoom.mockReturnValue({
        roomId: 'room-1',
        hostId: 'host-1',
        attackStack: 0,
        currentPower: 0,
        lastCard: null,
        drawPile: [],
        discardPile: [],
        lastActionId: 0,
        turnOwner: null,
        isBonusTurn: false,
        direction: GameDirection.CLOCKWISE,
        status: GameStatus.FINISHED,
        winnerId: 'host-1',
        winReason: WinReason.EMPTY_HAND,
        recentLogs: [],
        players: [
          {
            userId: 'user-2',
            nickname: 'guest',
            isGuest: true,
            hand: [],
            cardCount: 0,
            isReady: false,
            isConnected: true,
            disconnectedAt: null,
            isOut: false,
            role: 'SPECTATOR',
          },
        ],
      });

      const emit = jest.fn();
      gateway.server = {
        to: jest.fn().mockReturnValue({ emit }),
      } as unknown as Server;

      gateway.handleJoinRoom(client, { roomId: 'room-1' });

      expect(emit).toHaveBeenCalledWith(
        SocketEvent.ROOM_UPDATED,
        {
          message: 'guest님이 게임이 종료된 방에 관전자로 입장하셨습니다.',
        },
      );
    });
  });

  describe('handleGameReady', () => {
    it('FINISHED 상태에서는 gameReady 요청이 에러로 전파되어야 한다', () => {
      const client = {
        data: {
          user: {
            userId: 'user-1',
            nickname: 'tester',
            isGuest: false,
          },
        },
      } as Socket;

      roomService.toggleReady.mockImplementation(() => {
        throw new WsException('Cannot change ready state outside waiting room');
      });

      expect(() => {
        gateway.handleGameReady(client);
      }).toThrow(WsException);
    });
  });

  describe('handleReturnToWaiting', () => {
    it('FINISHED 상태의 방을 WAITING으로 되돌리고 ROOM_UPDATED를 전송해야 한다', () => {
      const client = {
        data: {
          user: {
            userId: 'user-1',
            nickname: 'tester',
            isGuest: false,
          },
        },
      } as Socket;

      const updatedRoom = {
        roomId: 'room-1',
        status: GameStatus.WAITING,
      } as GameRoom;

      roomService.resetRoomToWaiting.mockReturnValue(updatedRoom);

      const emit = jest.fn();
      gateway.server = {
        to: jest.fn().mockReturnValue({
          emit,
        }),
      } as unknown as Server;

      const result = gateway.handleReturnToWaiting(client);

      expect(roomService.resetRoomToWaiting).toHaveBeenCalledWith('user-1');
      expect(emit).toHaveBeenCalledWith(
        SocketEvent.ROOM_UPDATED,
        {
          message: '다음 게임 준비를 위해 로비 상태로 전환되었습니다.',
        },
      );
      expect(result).toBe(updatedRoom);
    });

    it('GameParticipantGuard와 RoomMasterGuard, GameResponseInterceptor가 적용되어야 한다', () => {
      const handler = GameGateway.prototype.handleReturnToWaiting;

      expect(
        Reflect.getMetadata(MESSAGE_MAPPING_METADATA, handler),
      ).toBe(true);
      expect(
        Reflect.getMetadata(MESSAGE_METADATA, handler),
      ).toBe(SocketEvent.RETURN_TO_WAITING);
      expect(
        Reflect.getMetadata(GUARDS_METADATA, handler),
      ).toEqual([
        GameParticipantGuard,
        RoomMasterGuard,
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
  let victoryService: jest.Mocked<VictoryService>;
  let gameActionQueue: jest.Mocked<GameActionQueue>;

  beforeEach(() => {
    jest.useFakeTimers();

    authService = createMock<AuthService>();
    gameService = createMock<GameService>();
    turnManager = createMock<TurnManagerService>();
    victoryService = createMock<VictoryService>();
    roomService = new RoomService(turnManager);
    gameActionQueue = createMock<GameActionQueue>();

    gateway = new GameGateway(
      authService,
      roomService,
      gameService,
      victoryService,
      gameActionQueue,
    );

    gateway.server = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as unknown as Server;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('disconnect 시 players 목록에서 제거되지 않아야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);
    roomService.joinRoom(room.roomId, guest);

    gateway.handleDisconnect(createClient(guest));

    const updatedRoom = roomService.getRoom(room.roomId);
    expect(updatedRoom?.players.some((player) => player.userId === guest.userId)).toBe(true);
  });

  it('disconnect 시 userToRoom 인덱스가 유지되어야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);
    roomService.joinRoom(room.roomId, guest);

    gateway.handleDisconnect(createClient(guest));

    expect(roomService.getUserRoom(guest.userId)).toBe(room.roomId);
  });

  it('disconnect 시 isConnected만 false가 되어야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);
    roomService.joinRoom(room.roomId, guest);

    gateway.handleDisconnect(createClient(guest));

    const updatedRoom = roomService.getRoom(room.roomId);
    expect(updatedRoom?.players.find((player) => player.userId === guest.userId)?.isConnected).toBe(false);
  });

  it('disconnect 시 hand와 room이 유지되어야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);
    const updatedRoom = roomService.joinRoom(room.roomId, guest);
    const joinedPlayer = updatedRoom.players.find((player) => player.userId === guest.userId)!;
    joinedPlayer.hand = [{
      id: uuidv4(),
      suit: CardSuit.RABBIT,
      declaredSuit: CardSuit.RABBIT,
      type: CardType.NUMBER,
      power: 0,
      value: '1',
      assetKey: 'rabbit_1',
    }];
    joinedPlayer.cardCount = 1;

    gateway.handleDisconnect(createClient(guest));

    const roomAfterDisconnect = roomService.getRoom(room.roomId);
    expect(roomAfterDisconnect?.roomId).toBe(room.roomId);
    expect(roomAfterDisconnect?.players.find((player) => player.userId === guest.userId)?.hand).toHaveLength(1);
  });

  it('disconnect 직후에는 방장 위임이나 턴 이동이 일어나지 않아야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);
    roomService.joinRoom(room.roomId, guest);
    room.status = 'PLAYING';
    room.turnOwner = host.userId;

    gateway.handleDisconnect(createClient(host));

    const updatedRoom = roomService.getRoom(room.roomId);
    expect(updatedRoom?.hostId).toBe(host.userId);
    expect(updatedRoom?.turnOwner).toBe(host.userId);
  });

  it('disconnect에서는 승리 판정을 시도하지 않아야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);

    roomService.joinRoom(room.roomId, guest);
    gateway.handleDisconnect(createClient(guest));

    expect(victoryService.determineWinner).not.toHaveBeenCalled();
  });

  it('유예시간이 지나도 복귀하지 않으면 실제 leaveRoom과 승리 판정을 수행해야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);
    const emit = jest.fn();

    gateway.server = {
      to: jest.fn().mockReturnValue({
        emit,
      }),
    } as unknown as Server;

    roomService.joinRoom(room.roomId, guest);
    gateway.handleDisconnect(createClient(guest));

    jest.advanceTimersByTime(30_000);

    expect(roomService.getUserRoom(guest.userId)).toBeUndefined();
    expect(victoryService.determineWinner).toHaveBeenCalledWith({
      room: expect.any(Object),
      trigger: 'PLAYER_LEFT',
      actorId: guest.userId,
    });
    expect(gameService.finishGame).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      SocketEvent.GAME_OVER,
      expect.objectContaining({
        winnerId: room.winnerId,
      }),
    );
  });

  it('disconnect timeout이 이미 삭제된 방에서도 안전하게 종료되어야 한다', () => {
    const host = mockUser(false);
    const guest = mockUser();
    const room = roomService.createRoom(host);

    roomService.joinRoom(room.roomId, guest);
    gateway.handleDisconnect(createClient(guest));

    roomService.leaveRoom(guest.userId);
    roomService.leaveRoom(host.userId);

    expect(() => {
      jest.advanceTimersByTime(30_000);
    }).not.toThrow();

    expect(victoryService.determineWinner).not.toHaveBeenCalled();
    expect(gameService.finishGame).not.toHaveBeenCalled();
    expect(roomService.getRoom(room.roomId)).toBeUndefined();
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
