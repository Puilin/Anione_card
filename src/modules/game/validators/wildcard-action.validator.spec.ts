import { WsException } from '@nestjs/websockets';

import {
  CardSuit,
  CardType,
} from 'src/shared/enums/game.enum';

import {
  Card,
  GameRoom,
  Player,
} from 'src/shared/interfaces/game.interface';

import { WildcardActionValidator } from './wildcard-action.validator';

describe('WildcardActionValidator', () => {
  let validator: WildcardActionValidator;

  beforeEach(() => {
    validator = new WildcardActionValidator();
  });

  const createMockCard = (
    overrides: Partial<Card> = {},
  ): Card => {
    const suit = overrides.suit ?? CardSuit.RABBIT;
    return {
      id: 'card-1',
      suit,
      declaredSuit: overrides.declaredSuit ?? suit,
      value: 'WILD',
      type: CardType.WILD,
      power: 0,
      assetKey: 'rabbit_wild',
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
    players: [],
    lastCard: createMockCard({
      id: 'last-card',
      suit: CardSuit.RABBIT,
      value: '3',
      type: CardType.NUMBER,
    }),
    attackStack: 0,
    ...overrides,
  });

  describe('supports', () => {
    it('WILD 타입 카드를 지원해야 한다', () => {
      const card = createMockCard({
        type: CardType.WILD,
        value: 'WILD',
      });

      expect(validator.supports(card)).toBe(true);
    });

    it('WILD이 아닌 타입은 지원하지 않아야 한다', () => {
      expect(
        validator.supports(createMockCard({
          type: CardType.NUMBER,
          value: '7',
        })),
      ).toBe(false);

      expect(
        validator.supports(createMockCard({
          type: CardType.ATTACK,
          value: 'SWORD_2',
          power: 2,
        })),
      ).toBe(false);

      expect(
        validator.supports(createMockCard({
          type: CardType.SPECIAL,
          value: 'SHIELD',
        })),
      ).toBe(false);
    });
  });

  describe('validate', () => {
    it('바닥 카드가 없으면 실패해야 한다', () => {
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
          chosenSuit: CardSuit.BEAR,
        }),
      ).toThrow(WsException);
    });

    it('공격 스택이 있을 때는 와일드카드를 낼 수 없다.', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.BEAR,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 3,
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.BEAR,
          type: CardType.ATTACK,
          value: 'SWORD_2',
          power: 2,
        }),
      });

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
          chosenSuit: CardSuit.RABBIT,
        }),
      ).toThrow();
    });

    it('일반적인 경우 바닥 카드와 동일한 동물 모양의 와일드카드를 낼 수 있어야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom();

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
          chosenSuit: CardSuit.BEAR,
        }),
      ).not.toThrow();
    });

    it('바닥 카드와 다른 동물 모양의 와일드카드는 낼 수 없어야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.CAT,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.RABBIT,
          value: '3',
          type: CardType.NUMBER,
        }),
      });

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
          chosenSuit: CardSuit.RABBIT,
        }),
      ).toThrow(WsException);
    });
  });
});
