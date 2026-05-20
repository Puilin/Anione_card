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

import { NormalCardValidator } from './normal-card-action.validator';

describe('NormalCardValidator', () => {
  let validator: NormalCardValidator;

  beforeEach(() => {
    validator = new NormalCardValidator();
  });

  const createMockCard = (
    overrides: Partial<Card> = {},
  ): Card => {
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

  const createMockPlayer = (
    overrides: Partial<Player> = {},
  ): Player => ({
    userId: 'user-1',
    nickname: 'tester',
    role: 'PLAYER',
    isGuest: false,
    isOut: false,
    isReady: true,
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
    }),
    ...overrides,
  });

  describe('validate', () => {
    it('같은 문양이면 성공해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.RABBIT,
        value: '7',
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
        }),
      ).not.toThrow();
    });

    it('같은 숫자면 성공해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.BEAR,
        value: '3',
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
        }),
      ).not.toThrow();
    });

    it('문양과 숫자가 모두 다르면 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.BEAR,
        value: '9',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.RABBIT,
          value: '1',
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

    it('NUMBER 타입 카드만 지원해야 한다', () => {
      expect(
        validator.supports(createMockCard({
          type: CardType.NUMBER,
          value: '7',
        })),
      ).toBe(true);

      expect(
        validator.supports(createMockCard({
          type: CardType.ATTACK,
          value: 'SWORD_2',
          power: 2,
        })),
      ).toBe(false);
    });

    it('공격 스택이 존재할 경우 일반 숫자 카드를 낼 수 없어야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        type: CardType.NUMBER,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 2,
        lastCard: createMockCard({ // 같은 동물 RABBIT이지만 공격 스택이 존재하므로 일반 카드로는 낼 수 없음
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
        }),
      ).toThrow(WsException);
    });
  });
});
