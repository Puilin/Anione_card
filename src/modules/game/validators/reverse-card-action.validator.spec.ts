import { WsException } from '@nestjs/websockets';

import {
  CardSuit,
  CardType,
} from 'src/shared/enums/game.enum';

import {
  GameRoom,
} from 'src/shared/interfaces/game.interface';

import { ReverseCardValidator } from './reverse-card-action.validator';
import { createSpecialValidatorFixtures } from './special-card-validator.spec.fixture';

describe('ReverseCardValidator', () => {
  let validator: ReverseCardValidator;

  beforeEach(() => {
    validator = new ReverseCardValidator();
  });

  const {
    createMockCard,
    createMockPlayer,
    createMockRoom,
  } = createSpecialValidatorFixtures(
    'REVERSE',
    'rabbit_reverse',
  );

  describe('validate', () => {
    it('공격 스택이 없고 같은 문양이면 성공해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.RABBIT,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 0,
      });

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
        }),
      ).not.toThrow();
    });

    it('공격 스택이 없고 같은 값(REVERSE)이면 성공해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.BEAR,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 0,
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.RABBIT,
          value: 'REVERSE',
          type: CardType.SPECIAL,
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

    it('문양과 값이 모두 다르면 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.BEAR,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 0,
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
        }),
      ).toThrow(WsException);
    });

    it('공격 스택이 존재하면 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 2,
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.RABBIT,
          value: 'SWORD_2',
          type: CardType.ATTACK,
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

    it('공격 스택 중에는 같은 REVERSE 카드여도 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.BEAR,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 2,
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.RABBIT,
          value: 'REVERSE',
          type: CardType.SPECIAL,
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

    it('REVERSE 값이 아닌 SPECIAL 카드는 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        value: 'JUMP',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 0,
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
  });

  describe('supports', () => {
    it('REVERSE SPECIAL 카드만 지원해야 한다', () => {
      expect(
        validator.supports(createMockCard({
          type: CardType.SPECIAL,
          value: 'REVERSE',
        })),
      ).toBe(true);

      expect(
        validator.supports(createMockCard({
          type: CardType.SPECIAL,
          value: 'JUMP',
        })),
      ).toBe(false);

      expect(
        validator.supports(createMockCard({
          type: CardType.ATTACK,
          value: 'SWORD_2',
          power: 2,
        })),
      ).toBe(false);
    });
  });
});
