import { WsException } from '@nestjs/websockets';

import {
  CardSuit,
  CardType,
} from 'src/shared/enums/game.enum';

import {
  GameRoom,
} from 'src/shared/interfaces/game.interface';

import { SkipCardValidator } from './skip-card-action.validator';
import { createSpecialValidatorFixtures } from './special-card-validator.spec.fixture';

describe('SkipCardValidator', () => {
  let validator: SkipCardValidator;

  beforeEach(() => {
    validator = new SkipCardValidator();
  });

  const {
    createMockCard,
    createMockPlayer,
    createMockRoom,
  } = createSpecialValidatorFixtures(
    'JUMP',
    'rabbit_jump',
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
      ).not.toThrow();
    });

    it('공격 스택이 없고 같은 값(JUMP)이면 성공해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.BEAR,
        value: 'JUMP',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 0,
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.RABBIT,
          value: 'JUMP',
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
        value: 'JUMP',
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

    it('공격 스택 중에는 같은 JUMP 카드여도 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.BEAR,
        value: 'JUMP',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 2,
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.RABBIT,
          value: 'JUMP',
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

    it('JUMP 값이 아닌 SPECIAL 카드는 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        value: 'REVERSE',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 0,
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.RABBIT,
          value: 'JUMP',
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
    it('JUMP SPECIAL 카드만 지원해야 한다', () => {
      expect(
        validator.supports(createMockCard({
          type: CardType.SPECIAL,
          value: 'JUMP',
        })),
      ).toBe(true);

      expect(
        validator.supports(createMockCard({
          type: CardType.SPECIAL,
          value: 'REVERSE',
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
