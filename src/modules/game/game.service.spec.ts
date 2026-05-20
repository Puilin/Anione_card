import { WsException } from "@nestjs/websockets";
import { CardSuit, CardType, GameDirection } from "src/shared/enums/game.enum";
import { Card, GameRoom, Player } from "src/shared/interfaces/game.interface";
import { v4 as uuidv4 } from 'uuid';
import { GameSetupService } from "./game-setup.service";
import { GameService } from "./game.service";
import { RoomService } from "../socket/room.service";
import { LogType } from "src/shared/enums/log.enum";
import { createMock } from '@golevelup/ts-jest';
import { ActionValidatorRegistry } from "./validators/action-validator.registry";
import { ActionValidator } from "./validators/action-validator.interface";

describe('GameService (Unit)', () => {
  let service: GameService;
  let gameSetupService: jest.Mocked<GameSetupService>;
  let roomService: jest.Mocked<RoomService>;
  let actionValidatorRegistry: jest.Mocked<ActionValidatorRegistry>;

  let host: ReturnType<typeof mockUser>;
  let room: GameRoom;

  beforeEach(() => {
    gameSetupService = createMock<GameSetupService>();
    roomService = createMock<RoomService>();
    actionValidatorRegistry = createMock<ActionValidatorRegistry>();

    service = new GameService(
      gameSetupService,
      roomService,
      actionValidatorRegistry,
    );

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

  describe('playCard', () => {
    let hostCard: Card;
    let guest: ReturnType<typeof mockUser>;
    let validator: ActionValidator;

    beforeEach(() => {
      guest = mockUser();
      room.players.push(createPlayer(guest, true));

      room.status = 'PLAYING';
      room.turnOwner = host.userId;
      room.direction = GameDirection.CLOCKWISE;
      room.attackStack = 0;
      room.currentPower = 0;
      room.lastActionId = 0;
      room.lastCard = createMockCard({
        id: uuidv4(),
        suit: CardSuit.RABBIT,
        type: CardType.NUMBER,
        value: '5',
      });
      room.discardPile = [room.lastCard];

      hostCard = createMockCard({
        id: uuidv4(),
        suit: CardSuit.RABBIT,
        type: CardType.NUMBER,
        value: '7',
      });
      room.players[0].hand = [hostCard];
      room.players[0].cardCount = 1;

      validator = {
        supports: jest.fn().mockReturnValue(true),
        validate: jest.fn(),
      };

      roomService.getNextTurnOwner.mockImplementation(
        (targetRoom, currentUserId) => {
          const activePlayers = targetRoom.players.filter(
            (p) => p.role === 'PLAYER' && !p.isOut,
          );

          if (activePlayers.length === 1) {
            return activePlayers[0].userId;
          }

          const index = activePlayers.findIndex(
            (p) => p.userId === currentUserId,
          );
          const nextIndex =
            (index + targetRoom.direction + activePlayers.length) %
            activePlayers.length;

          return activePlayers[nextIndex].userId;
        },
      );

      actionValidatorRegistry.getValidator.mockReturnValue(
        validator,
      );
    });

    it('정상 카드 제출 시 registry를 호출해야 한다', () => {
      service.playCard(host.userId, hostCard.id);

      expect(
        actionValidatorRegistry.getValidator,
      ).toHaveBeenCalledWith(hostCard);
      expect(
        validator.validate,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          room,
          player: expect.objectContaining({
            userId: host.userId,
          }),
          card: hostCard,
        }),
      );
    });

    it('validator 미존재/중복 예외를 그대로 전파해야 한다', () => {
      actionValidatorRegistry.getValidator.mockImplementation(() => {
        throw new WsException('No validator found for card: X');
      });

      expect(() =>
        service.playCard(host.userId, hostCard.id),
      ).toThrow(WsException);
    });

    it('검증 통과 후 hand/discard/turn/lastActionId를 반영하고 로깅해야 한다', () => {
      const updatedRoom = service.playCard(host.userId, hostCard.id);

      const updatedHost = updatedRoom.players.find(
        p => p.userId === host.userId,
      )!;

      expect(updatedHost.hand).toHaveLength(0);
      expect(updatedHost.cardCount).toBe(0);

      expect(updatedRoom.lastCard?.id).toBe(hostCard.id);
      expect(
        updatedRoom.discardPile[
          updatedRoom.discardPile.length - 1
        ]?.id,
      ).toBe(hostCard.id);
      expect(updatedRoom.lastActionId).toBe(1);
      expect(updatedRoom.turnOwner).toBe(guest.userId);
      expect(roomService.pushLog).toHaveBeenCalledTimes(1);
    });

    const setHostCardForPlay = (
      card: Card,
    ) => {
      const hostPlayer = room.players.find(
        p => p.userId === host.userId,
      )!;

      room.turnOwner = host.userId;
      hostPlayer.hand = [card];
      hostPlayer.cardCount = 1;

      return hostPlayer;
    };

    it('ATTACK 카드면 attackStack을 증가시키고 타겟을 포함한 로그를 남겨야 한다', () => {
      const attackCard = createMockCard({
        id: uuidv4(),
        type: CardType.ATTACK,
        value: 'SWORD_3',
        power: 3,
        suit: CardSuit.RABBIT,
      });

      setHostCardForPlay(attackCard);

      service.playCard(host.userId, attackCard.id);

      expect(room.attackStack).toBe(3);
      expect(room.currentPower).toBe(3);
      expect(room.turnOwner).toBe(guest.userId);
      expect(roomService.pushLog).toHaveBeenCalledWith(
        room,
        expect.objectContaining({
          type: LogType.ATTACK,
          actorId: host.userId,
          cardId: attackCard.id,
          targetId: guest.userId,
        }),
      );
    });

    it('SHIELD 카드면 attackStack을 초기화해야 한다', () => {
      const shieldCard = createMockCard({
        id: uuidv4(),
        type: CardType.SPECIAL,
        value: 'SHIELD',
        suit: CardSuit.RABBIT,
      });

      room.attackStack = 3;
      room.currentPower = 3;
      setHostCardForPlay(shieldCard);

      service.playCard(host.userId, shieldCard.id);

      expect(room.attackStack).toBe(0);
      expect(room.currentPower).toBe(0);
      expect(room.turnOwner).toBe(guest.userId);
    });

    it('EVADE 카드면 현재 구현 기준 공격 수치를 유지해야 한다', () => {
      const evadeCard = createMockCard({
        id: uuidv4(),
        type: CardType.SPECIAL,
        value: 'EVADE',
        suit: CardSuit.RABBIT,
      });

      room.attackStack = 2;
      room.currentPower = 2;
      setHostCardForPlay(evadeCard);

      service.playCard(host.userId, evadeCard.id);

      expect(room.attackStack).toBe(2);
      expect(room.currentPower).toBe(2);
      expect(room.turnOwner).toBe(guest.userId);
    });

    it('BONUS 카드면 턴을 유지해야 한다', () => {
      const bonusCard = createMockCard({
        id: uuidv4(),
        type: CardType.SPECIAL,
        value: 'BONUS',
        suit: CardSuit.RABBIT,
      });

      setHostCardForPlay(bonusCard);

      service.playCard(host.userId, bonusCard.id);

      expect(room.turnOwner).toBe(host.userId);
      expect(room.isBonusTurn).toBe(true);
    });

    it('REVERSE 카드면 진행 방향을 반전해야 한다', () => {
      const reverseCard = createMockCard({
        id: uuidv4(),
        type: CardType.SPECIAL,
        value: 'REVERSE',
        suit: CardSuit.RABBIT,
      });

      const previousDirection = room.direction;
      setHostCardForPlay(reverseCard);

      service.playCard(host.userId, reverseCard.id);

      expect(room.direction).toBe(previousDirection * -1);
      expect(room.turnOwner).toBe(guest.userId);
    });

    it('SKIP(JUMP) 카드면 한 명을 건너뛰어 턴을 유지해야 한다', () => {
      const skipCard = createMockCard({
        id: uuidv4(),
        type: CardType.SPECIAL,
        value: 'JUMP',
        suit: CardSuit.RABBIT,
      });

      room.direction = GameDirection.CLOCKWISE;
      setHostCardForPlay(skipCard);

      service.playCard(host.userId, skipCard.id);

      expect(room.turnOwner).toBe(host.userId);
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
