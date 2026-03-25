import { WsException } from "@nestjs/websockets";
import { CardSuit, CardType, GameDirection } from "src/shared/enums/game.enum";
import { Card, GameRoom, Player } from "src/shared/interfaces/game.interface";
import { v4 as uuidv4 } from 'uuid';
import { GameSetupService } from "./game-setup.service";
import { GameService } from "./game.service";
import { RoomService } from "../socket/room.service";
import { LogType } from "src/shared/enums/log.enum";
import { createMock } from '@golevelup/ts-jest';

describe('GameService (Unit)', () => {
  let service: GameService;
  let gameSetupService: jest.Mocked<GameSetupService>;
  let roomService: jest.Mocked<RoomService>;

  let host: ReturnType<typeof mockUser>;
  let room: GameRoom;

  beforeEach(() => {
    gameSetupService = createMock<GameSetupService>();
    roomService = createMock<RoomService>();

    service = new GameService(gameSetupService, roomService);

    host = mockUser();
    room = createMockRoom(host);

    roomService.getUserRoom.mockReturnValue(room.roomId);
    roomService.getRoom.mockReturnValue(room);
    roomService.createSystemLog.mockReturnValue({
      id: 'log-id',
      type: LogType.GAME_START,
      actorId: host.userId,
      actorName: host.nickname,
      timestamp: Date.now(),
      payload: { message: 'message' },
    });

    const mockDeck = Array.from({ length: 76 }, () => createMockCard());

    gameSetupService.createDeck.mockReturnValue(mockDeck);

    gameSetupService.distributeCards.mockImplementation((deck, players, count) => {
      const updatedPlayers = players.map(p => ({
        ...p,
        hand: Array.from({ length: count }, () => createMockCard()),
        cardCount: count,
      }));

      return {
        updatedPlayers,
        remainingDeck: deck.slice(players.length * count),
      };
    });
  });

  describe('startGame', () => {

    it('방장이 아닌 유저가 시작하면 에러가 발생해야 한다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest));

      expect(() => {
        service.startGame(guest.userId);
      }).toThrow(WsException);
    });

    it('플레이어가 2명 미만이면 시작할 수 없다', () => {
      expect(() => {
        service.startGame(host.userId);
      }).toThrow(WsException);
    });

    it('이미 PLAYING 상태이면 시작할 수 없다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, true));

      room.status = 'PLAYING';

      expect(() => {
        service.startGame(host.userId);
      }).toThrow(WsException);
    });

    it('모든 플레이어가 준비 상태가 아니면 시작할 수 없다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, false));

      expect(() => {
        service.startGame(host.userId);
      }).toThrow(WsException);
    });

    it('게임 시작 시 모든 플레이어는 7장의 카드를 받아야 한다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, true));

      const updatedRoom = service.startGame(host.userId);

      updatedRoom.players
        .filter(p => p.role === 'PLAYER')
        .forEach(p => {
          expect(p.hand.length).toBe(7);
          expect(p.cardCount).toBe(7);
        });
    });

    it('lastCard가 설정되어야 한다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, true));

      const updatedRoom = service.startGame(host.userId);

      expect(updatedRoom.lastCard).not.toBeNull();
    });

    it('첫 카드는 NUMBER 카드여야 한다 (특수 카드 skip)', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, true));

      const specialCard = createMockCard({ type: CardType.ATTACK });
      const numberCard = createMockCard({ type: CardType.NUMBER });

      gameSetupService.distributeCards.mockReturnValue({
        updatedPlayers: room.players,
        remainingDeck: [specialCard, specialCard, numberCard],
      });

      const updatedRoom = service.startGame(host.userId);

      expect(updatedRoom.lastCard?.type).toBe(CardType.NUMBER);
    });

    it('상태가 PLAYING으로 변경되어야 한다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, true));

      const updatedRoom = service.startGame(host.userId);

      expect(updatedRoom.status).toBe('PLAYING');
    });

    it('turnOwner는 플레이어 중 한 명이어야 한다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, true));

      const updatedRoom = service.startGame(host.userId);

      const playerIds = updatedRoom.players
        .filter(p => p.role === 'PLAYER')
        .map(p => p.userId);

      expect(playerIds).toContain(updatedRoom.turnOwner);
    });

    it('direction은 CLOCKWISE로 초기화되어야 한다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, true));

      const updatedRoom = service.startGame(host.userId);

      expect(updatedRoom.direction).toBe(GameDirection.CLOCKWISE);
    });

    it('attackStack과 currentPower는 0으로 초기화되어야 한다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, true));

      room.attackStack = 5;
      room.currentPower = 3;

      const updatedRoom = service.startGame(host.userId);

      expect(updatedRoom.attackStack).toBe(0);
      expect(updatedRoom.currentPower).toBe(0);
    });

    it('lastActionId가 초기화되어야 한다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, true));

      room.lastActionId = 10;

      const updatedRoom = service.startGame(host.userId);

      expect(updatedRoom.lastActionId).toBe(0);
    });

    it('로그가 생성되어야 한다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, true));

      service.startGame(host.userId);

      expect(roomService.createSystemLog).toHaveBeenCalledWith(
        room,
        room.hostId,
        LogType.GAME_START,
        '게임이 시작되었습니다.'
      );

      expect(roomService.pushLog).toHaveBeenCalled();
    });

    it('게임 시작 시 카드 셋업 파이프라인이 실행되어야 한다', () => {
      const guest = mockUser();
      room.players.push(createPlayer(guest, true));

      service.startGame(host.userId);

      expect(gameSetupService.createDeck).toHaveBeenCalled();
      expect(gameSetupService.shuffle).toHaveBeenCalledWith(expect.any(Array));

      expect(gameSetupService.distributeCards).toHaveBeenCalledWith(
        expect.any(Array),
        expect.arrayContaining([
          expect.objectContaining({ role: 'PLAYER' })
        ]),
        7
      );
    });

    it('관전자는 카드 분배 대상에서 제외되어야 한다', () => {
      const guest = mockUser();
      const spectator = mockUser();

      room.players.push(createPlayer(guest, true));
      room.players.push(createSpectator(spectator));

      const updatedRoom = service.startGame(host.userId);

      const spec = updatedRoom.players.find(p => p.role === 'SPECTATOR');

      expect(spec?.hand.length).toBe(0);
    });

  });
});

// helper functions for tests
function createMockRoom(host: ReturnType<typeof mockUser>): GameRoom {
  return {
    roomId: uuidv4(),
    hostId: host.userId,
    attackStack: 0,
    currentPower: 0,
    lastCard: null,
    drawPile: [],
    discardPile: [],
    lastActionId: 0,
    turnOwner: null,
    isBonusTurn: false,
    direction: GameDirection.CLOCKWISE,
    players: [createPlayer(host, true)],
    status: 'WAITING',
    recentLogs: [],
  };
}

function createPlayer(user: ReturnType<typeof mockUser>, isReady = false): Player {
  return {
    ...user,
    hand: [],
    cardCount: 0,
    isReady,
    isOut: false,
    role: 'PLAYER',
  };
}

function createSpectator(user: ReturnType<typeof mockUser>): Player {
  return {
    ...user,
    hand: [],
    cardCount: 0,
    isReady: false,
    isOut: false,
    role: 'SPECTATOR',
  };
}

function mockUser() {
  const userId = uuidv4();
  return {
    userId,
    nickname: `Guest_${userId.slice(0, 5)}`,
    isGuest: true,
  };
}

function createMockCard(overrides?: Partial<Card>): Card {
  return {
    id: uuidv4(),
    suit: CardSuit.RABBIT,
    type: CardType.NUMBER,
    value: '1',
    power: 0,
    assetKey: 'rabbit_number_1',
    ...overrides,
  };
}