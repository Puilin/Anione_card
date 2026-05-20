import { WsException } from '@nestjs/websockets';

import { CardSuit, CardType } from 'src/shared/enums/game.enum';

import {
  BaseActionValidator,
  ValidateActionParams,
} from './base-action.validator';
import { Card, GameRoom, Player } from 'src/shared/interfaces/game.interface';

describe('BaseActionValidator', () => {
  class TestValidator extends BaseActionValidator {
    supports(_card: Card): boolean {
      return true;
    }

    protected validateRule(
      params: ValidateActionParams,
    ): void {
      // 테스트용 no-op
    }
  }

  let validator: TestValidator;

  beforeEach(() => {
    validator = new TestValidator();
  });

  const createMockCard = (overrides: Partial<Card> = {}) => {
    const suit = overrides.suit ?? CardSuit.RABBIT;
    return {
      id: 'card-1',
      suit,
      declaredSuit: overrides.declaredSuit ?? suit,
      value: '1',
      type: CardType.NUMBER,
      power: 0,
      assetKey: 'rabbit_1',
      ...overrides,
    };
  };

  const createMockPlayer = (overrides: Partial<Player> = {}) => ({
    userId: 'user-1',
    nickname: 'tester',
    role: 'PLAYER' as const,
    isGuest: false,
    isOut: false,
    cardCount: 1,
    isReady: true,
    hand: [createMockCard()],
    ...overrides,
  });

  const createMockRoom = (overrides: Partial<GameRoom> = {}) => ({
    roomId: 'room-1',
    status: 'PLAYING',
    turnOwner: 'user-1',
    players: [],
    lastCard: createMockCard(),
    hostId: 'user-1',
    ...overrides,
  } as GameRoom);

  describe('validate', () => {
    it('모든 검증이 통과하면 패스해야 한다', () => {
      const player = createMockPlayer();

      const room = createMockRoom({
        players: [player],
        turnOwner: player.userId,
      });

      expect(() =>
        validator.validateBase({
          room,
          player,
        }),
      ).not.toThrow();
    });

    it('게임이 시작되지 않았을 경우 예외를 던져야 한다', () => {
      const player = createMockPlayer();

      const room = createMockRoom({
        status: 'WAITING',
      });

      expect(() =>
        validator.validateBase({
          room,
          player,
        }),
      ).toThrow(WsException);
    });

    it('플레이어 턴이 아닐 경우 예외를 던져야 한다', () => {
      const player = createMockPlayer();

      const room = createMockRoom({
        turnOwner: 'another-user',
      });

      expect(() =>
        validator.validateBase({
          room,
          player,
        }),
      ).toThrow(WsException);
    });

    it('플레이어가 아웃 상태일 경우 예외를 던져야 한다', () => {
      const player = createMockPlayer({
        isOut: true,
      });

      const room = createMockRoom();

      expect(() =>
        validator.validateBase({
          room,
          player,
        }),
      ).toThrow(WsException);
    });

    it('관전자일 경우 예외를 던져야 한다', () => {
      const player = createMockPlayer({
        role: 'SPECTATOR',
      });

      const room = createMockRoom();

      expect(() =>
        validator.validateBase({
          room,
          player,
        }),
      ).toThrow(WsException);
    });
  });
});
