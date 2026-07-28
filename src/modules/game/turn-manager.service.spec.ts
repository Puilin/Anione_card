import { WsException } from '@nestjs/websockets';

import {
  CardSuit,
  CardType,
  GameDirection,
} from 'src/shared/enums/game.enum';
import {
  Card,
  GameRoom,
  Player,
} from 'src/shared/interfaces/game.interface';

import { TurnManagerService } from './turn-manager.service';

describe('TurnManagerService', () => {
  let service: TurnManagerService;

  beforeEach(() => {
    service = new TurnManagerService();
  });

  describe('pickFirstTurnOwner', () => {
    it('활성 플레이어 중 한 명을 첫 턴 주인으로 반환해야 한다', () => {
      const room = createMockRoom();

      const randomSpy = jest
        .spyOn(Math, 'random')
        .mockReturnValue(0.8);

      const turnOwner =
        service.pickFirstTurnOwner(room);

      expect(turnOwner).toBe('guest-2');

      randomSpy.mockRestore();
    });
  });

  describe('getNextActivePlayerId', () => {
    it('방향에 따라 다음 활성 플레이어를 반환해야 한다', () => {
      const room = createMockRoom({
        direction:
          GameDirection.COUNTER_CLOCKWISE,
      });

      const nextPlayerId =
        service.getNextActivePlayerId(
          room,
          'host',
        );

      expect(nextPlayerId).toBe('guest-2');
    });

    it('stepCount 만큼 전진해야 한다', () => {
      const room = createMockRoom();

      const nextPlayerId =
        service.getNextActivePlayerId(
          room,
          'host',
          2,
        );

      expect(nextPlayerId).toBe('guest-2');
    });

    it('활성 플레이어가 없으면 예외가 발생해야 한다', () => {
      const room = createMockRoom({
        players: [
          createPlayer('host', {
            isOut: true,
          }),
        ],
      });

      expect(() =>
        service.getNextActivePlayerId(
          room,
          'host',
        ),
      ).toThrow(
        new WsException('No active players'),
      );
    });

    it('탈락한 플레이어는 건너뛰고 다음 활성 플레이어를 반환해야 한다', () => {
      const room = createMockRoom({
        players: [
          createPlayer('host'),
          createPlayer('guest-1', {
            isOut: true,
          }),
          createPlayer('guest-2'),
          createPlayer('guest-3'),
        ],
      });

      const nextPlayerId =
        service.getNextActivePlayerId(
          room,
          'host',
        );

      expect(nextPlayerId).toBe('guest-2');
    });
  });

  describe('resolveTurnAfterCard', () => {
    it('BONUS effect 는 현재 플레이어의 즉시 추가 행동을 허용하고, room 에 bonusTurn 상태도 남겨야 한다', () => {
      const room = createMockRoom();
      const player = room.players[0];
      const effect = {
        keepTurn: true,
        advanceSteps: 1,
        reverseDirection: false,
        bonusTurn: true,
      };

      const nextTurnOwner =
        service.applyTurnEffect({
          room,
          playerId: player.userId,
          effect,
        });

      expect(nextTurnOwner).toBe(player.userId);
      expect(room.turnOwner).toBe(player.userId);
      expect(room.isBonusTurn).toBe(true);
    });

    it('JUMP 카드는 두 칸 전진해야 한다', () => {
      const room = createMockRoom();
      const player = room.players[0];
      const effect = {
        keepTurn: false,
        advanceSteps: 2,
        reverseDirection: false,
        bonusTurn: false,
      };

      const nextTurnOwner =
        service.applyTurnEffect({
          room,
          playerId: player.userId,
          effect,
        });

      expect(nextTurnOwner).toBe('guest-2');
      expect(room.turnOwner).toBe('guest-2');
      expect(room.isBonusTurn).toBe(false);
    });

    it('2인 플레이에서 JUMP 카드는 자기 자신에게 턴이 돌아와야 한다', () => {
      const room = createMockRoom({
        players: [
          createPlayer('host'),
          createPlayer('guest-1'),
        ],
      });
      const player = room.players[0];
      const effect = {
        keepTurn: false,
        advanceSteps: 2,
        reverseDirection: false,
        bonusTurn: false,
      };

      const nextTurnOwner =
        service.applyTurnEffect({
          room,
          playerId: player.userId,
          effect,
        });

      expect(nextTurnOwner).toBe('host');
      expect(room.turnOwner).toBe('host');
    });

    it('4인 플레이에서 JUMP 카드는 두 명째 다음 플레이어에게 넘어가야 한다', () => {
      const room = createMockRoom({
        players: [
          createPlayer('host'),
          createPlayer('guest-1'),
          createPlayer('guest-2'),
          createPlayer('guest-3'),
        ],
      });
      const player = room.players[0];
      const effect = {
        keepTurn: false,
        advanceSteps: 2,
        reverseDirection: false,
        bonusTurn: false,
      };

      const nextTurnOwner =
        service.applyTurnEffect({
          room,
          playerId: player.userId,
          effect,
        });

      expect(nextTurnOwner).toBe('guest-2');
      expect(room.turnOwner).toBe('guest-2');
    });

    it('REVERSE 카드는 방향을 반전한 뒤 다음 턴을 계산해야 한다', () => {
      const room = createMockRoom();
      const player = room.players[0];
      const effect = {
        keepTurn: false,
        advanceSteps: 1,
        reverseDirection: true,
        bonusTurn: false,
      };

      const nextTurnOwner =
        service.applyTurnEffect({
          room,
          playerId: player.userId,
          effect,
        });

      expect(room.direction).toBe(
        GameDirection.COUNTER_CLOCKWISE,
      );
      expect(nextTurnOwner).toBe('guest-2');
      expect(room.turnOwner).toBe('guest-2');
    });

    it('2인 플레이에서 REVERSE 카드는 상대 플레이어에게 턴이 넘어가야 한다', () => {
      const room = createMockRoom({
        players: [
          createPlayer('host'),
          createPlayer('guest-1'),
        ],
      });
      const player = room.players[0];
      const effect = {
        keepTurn: false,
        advanceSteps: 1,
        reverseDirection: true,
        bonusTurn: false,
      };

      const nextTurnOwner =
        service.applyTurnEffect({
          room,
          playerId: player.userId,
          effect,
        });

      expect(room.direction).toBe(
        GameDirection.COUNTER_CLOCKWISE,
      );
      expect(nextTurnOwner).toBe('guest-1');
      expect(room.turnOwner).toBe('guest-1');
    });

    it('4인 플레이에서 REVERSE 카드는 반대 방향의 직전 플레이어에게 턴이 넘어가야 한다', () => {
      const room = createMockRoom({
        players: [
          createPlayer('host'),
          createPlayer('guest-1'),
          createPlayer('guest-2'),
          createPlayer('guest-3'),
        ],
      });
      const player = room.players[0];
      const effect = {
        keepTurn: false,
        advanceSteps: 1,
        reverseDirection: true,
        bonusTurn: false,
      };

      const nextTurnOwner =
        service.applyTurnEffect({
          room,
          playerId: player.userId,
          effect,
        });

      expect(room.direction).toBe(
        GameDirection.COUNTER_CLOCKWISE,
      );
      expect(nextTurnOwner).toBe('guest-3');
      expect(room.turnOwner).toBe('guest-3');
    });

    it('일반 진행 effect 는 턴을 넘기면서 room 의 bonusTurn 상태를 해제해야 한다', () => {
      const room = createMockRoom({
        isBonusTurn: true,
      });
      const player = room.players[0];
      const effect = {
        keepTurn: false,
        advanceSteps: 1,
        reverseDirection: false,
        bonusTurn: false,
      };

      service.applyTurnEffect({
        room,
        playerId: player.userId,
        effect,
      });

      expect(room.isBonusTurn).toBe(false);
      expect(room.turnOwner).toBe('guest-1');
    });
  });

  describe('resolveTurnAfterDraw', () => {
    it('드로우 후 다음 플레이어에게 턴을 넘겨야 한다', () => {
      const room = createMockRoom();
      const player = room.players[0];

      const nextTurnOwner =
        service.resolveTurnAfterDraw({
          room,
          player,
        });

      expect(nextTurnOwner).toBe('guest-1');
      expect(room.turnOwner).toBe('guest-1');
    });
  });

  describe('resolveTurnAfterLeave', () => {
    it('현재 턴 플레이어가 나가면, 나가는 유저가 players 배열에 남아있는지와 무관하게 remainingPlayers 기준으로 다음 턴 주인을 계산해야 한다', () => {
      const room = createMockRoom({
        turnOwner: 'host',
      });

      const nextTurnOwner =
        service.resolveTurnAfterLeave({
          room,
          currentTurnOwnerId: 'host',
          remainingPlayers: room.players.filter(
            (player) => player.userId !== 'host',
          ),
        });

      expect(nextTurnOwner).toBe('guest-1');
    });

    it('현재 턴 플레이어가 아니면 null 을 반환해야 한다', () => {
      const room = createMockRoom({
        turnOwner: 'guest-1',
      });

      const nextTurnOwner =
        service.resolveTurnAfterLeave({
          room,
          currentTurnOwnerId: 'host',
          remainingPlayers: room.players.filter(
            (player) => player.userId !== 'host',
          ),
        });

      expect(nextTurnOwner).toBeNull();
    });

    it('현재 턴 플레이어가 나가고 다음 순번 플레이어가 탈락 상태면 그 다음 활성 플레이어에게 넘어가야 한다', () => {
      const room = createMockRoom({
        players: [
          createPlayer('host'),
          createPlayer('guest-1', {
            isOut: true,
          }),
          createPlayer('guest-2'),
        ],
        turnOwner: 'host',
      });

      const nextTurnOwner =
        service.resolveTurnAfterLeave({
          room,
          currentTurnOwnerId: 'host',
          remainingPlayers: room.players.filter(
            (player) => player.userId !== 'host',
          ),
        });

      expect(nextTurnOwner).toBe('guest-2');
    });
  });
});

function createMockRoom(
  overrides: Partial<GameRoom> = {},
): GameRoom {
  const players =
    overrides.players ?? [
      createPlayer('host'),
      createPlayer('guest-1'),
      createPlayer('guest-2'),
    ];

  return {
    roomId: 'room-1',
    hostId: 'host',
    attackStack: 0,
    currentPower: 0,
    lastCard: null,
    drawPile: [],
    discardPile: [],
    lastActionId: 0,
    turnOwner: 'host',
    isBonusTurn: false,
    direction: GameDirection.CLOCKWISE,
    players,
    status: 'PLAYING',
    winnerId: null,
    winReason: null,
    recentLogs: [],
    ...overrides,
  };
}

function createPlayer(
  userId: string,
  overrides: Partial<Player> = {},
): Player {
  return {
    userId,
    nickname: userId,
    isGuest: false,
    hand: [],
    cardCount: 0,
    isReady: true,
    isConnected: true,
    disconnectedAt: null,
    isOut: false,
    role: 'PLAYER',
    ...overrides,
  };
}
