import { WsException } from '@nestjs/websockets';

import {
  CardSuit,
  CardType,
} from 'src/shared/enums/game.enum';

import {
  GameRoom,
} from 'src/shared/interfaces/game.interface';

import { BonusCardValidator } from './bonus-card-action.validator';
import { createSpecialValidatorFixtures } from './special-card-validator.spec.fixture';

describe('BonusCardValidator', () => {
  let validator: BonusCardValidator;

  beforeEach(() => {
    validator = new BonusCardValidator();
  });

  const {
    createMockCard,
    createMockPlayer,
    createMockRoom,
  } = createSpecialValidatorFixtures(
    'BONUS',
    'rabbit_bonus',
  );

  describe('validate', () => {
    it('같은 문양이면 성공해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.RABBIT,
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 0,
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.RABBIT,
          value: '4',
          type: CardType.NUMBER,
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

    it('바닥 카드가 BONUS여도 성공하면 안 된다', () => {
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
          value: 'BONUS',
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

    it('문양이 다르면 실패해야 한다', () => {
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
          value: '7',
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

    it('BONUS 값이 아닌 SPECIAL 카드는 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        value: 'REVERSE',
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
    it('BONUS SPECIAL 카드만 지원해야 한다', () => {
      expect(
        validator.supports(createMockCard({
          type: CardType.SPECIAL,
          value: 'BONUS',
        })),
      ).toBe(true);

      expect(
        validator.supports(createMockCard({
          type: CardType.SPECIAL,
          value: 'SHIELD',
        })),
      ).toBe(false);

      expect(
        validator.supports(createMockCard({
          type: CardType.NUMBER,
          value: '7',
        })),
      ).toBe(false);
    });
  });
});
