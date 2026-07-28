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

import { AttackCardValidator } from './attack-card-action.validator';

describe('AttackCardValidator', () => {
  let validator: AttackCardValidator;

  beforeEach(() => {
    validator = new AttackCardValidator();
  });

  const createMockCard = (
    overrides: Partial<Card> = {},
  ): Card => {
    const suit = overrides.suit ?? CardSuit.RABBIT;
    return {
      id: 'card-1',
      suit,
      declaredSuit: overrides.declaredSuit ?? suit,
      value: 'SWORD_2',
      type: CardType.ATTACK,
      power: 2,
      assetKey: 'rabbit_sword_2',
      ...overrides,
    };
  };

  const createMockPlayer = (
    overrides: Partial<Player> = {},
  ): Player => ({
    userId: 'user-1',
    nickname: 'tester',
    role: 'PLAYER',
    isGuest: false,
    isOut: false,
    isReady: true,
    isConnected: true,
    disconnectedAt: null,
    cardCount: 1,
    hand: [createMockCard()],
    ...overrides,
  });

  const createMockRoom = (
    overrides: Partial<GameRoom> = {},
  ): Partial<GameRoom> => ({
    roomId: 'room-1',
    hostId: 'user-1',
    status: 'PLAYING',
    turnOwner: 'user-1',
    direction: GameDirection.CLOCKWISE,
    attackStack: 0,
    isBonusTurn: false,
    players: [],
    lastCard: createMockCard({
      id: 'last-card',
      suit: CardSuit.RABBIT,
      value: 'SWORD_2',
      power: 2,
    }),
    ...overrides,
  });

  describe('validate', () => {
    it('공격 체인이 아닐 때 같은 동물이면 성공해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.RABBIT,
        value: 'SWORD_3',
        power: 3,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 0,
        lastCard: createMockCard({
          suit: CardSuit.RABBIT,
          value: '7',
          power: 0,
        }),
      });

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
        }),
      ).not.toThrow();
    });

    it('공격 체인 중 현재 공격값 이상이면 성공해야 한다', () => {
      const card = createMockCard({
        id: 'card-4',
        suit: CardSuit.BEAR, // 문양 달라도 가능
        value: 'SWORD_3',
        power: 3,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 2,
        lastCard: createMockCard({
          suit: CardSuit.RABBIT,
          value: 'SWORD_2',
          power: 2,
        }),
      });

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
        }),
      ).not.toThrow();
    });

    it('공격 체인 중 현재 공격값보다 낮으면 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.BEAR,
        value: 'SWORD_2',
        power: 2,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 3,
        lastCard: createMockCard({
          suit: CardSuit.RABBIT,
          value: 'SWORD_3',
          power: 3,
        }),
      });

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
        }),
      ).toThrow(WsException);
    });

    it('공격 체인이 아닐 때 동물모양이 다르면 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.BEAR,
        value: 'SWORD_3',
        power: 3,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 0,
        lastCard: createMockCard({
          suit: CardSuit.RABBIT,
          value: '4',
          power: 0,
        }),
      });

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
        }),
      ).toThrow(WsException);
    });

    it('마지막 카드가 없으면 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        lastCard: null,
      });

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
        }),
      ).toThrow(WsException);
    });

    it('ATTACK 타입 카드만 지원해야 한다', () => {
      expect(
        validator.supports(createMockCard({
          type: CardType.ATTACK,
          value: 'SWORD_2',
          power: 2,
        })),
      ).toBe(true);

      expect(
        validator.supports(createMockCard({
          type: CardType.NUMBER,
          value: '7',
          power: 0,
        })),
      ).toBe(false);
    });

    it('공격 체인 중 같은 power도 허용되어야 한다', () => {
      const card = createMockCard({
        id: 'card-3',
        suit: CardSuit.BEAR,
        value: 'SWORD_3',
        power: 3,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 3,
        lastCard: createMockCard({
          suit: CardSuit.RABBIT,
          value: 'SWORD_3',
          power: 3,
        }),
      });

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
        }),
      ).not.toThrow();
    });

    it('공격 체인 중에는 문양이 같아도 현재 공격값보다 낮으면 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.RABBIT, // 문양은 같음
        value: 'SWORD_2',
        power: 2,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 3,
        lastCard: createMockCard({
          suit: CardSuit.RABBIT,
          value: 'SWORD_3',
          power: 3,
        }),
      });

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
        }),
      ).toThrow(WsException);
    });
  });
});
