import { WsException } from '@nestjs/websockets';

import {
  CardSuit,
  CardType,
} from 'src/shared/enums/game.enum';

import {
  GameRoom,
} from 'src/shared/interfaces/game.interface';

import { ShieldCardValidator } from './shield-card-action.validator';
import { createSpecialValidatorFixtures } from './special-card-validator.spec.fixture';

describe('ShieldCardValidator', () => {
  let validator: ShieldCardValidator;

  beforeEach(() => {
    validator = new ShieldCardValidator();
  });

  const {
    createMockCard,
    createMockPlayer,
    createMockRoom,
  } = createSpecialValidatorFixtures(
    'SHIELD',
    'rabbit_shield',
  );

  describe('validate', () => {
    it('공격 스택이 존재하면 성공해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 2,
      });

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card,
        }),
      ).not.toThrow();
    });

    it('공격 스택이 없어도 바닥 카드가 SHIELD면 성공해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 0,
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.BEAR,
          value: 'SHIELD',
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

    it('공격 스택이 없고 바닥 카드가 SHIELD가 아니며 모양도 다르면 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 0,
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.BEAR,
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

    it('공격 스택이 없어도 같은 문양이면 성공해야 한다', () => {
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
          suit: CardSuit.BEAR,
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
      ).not.toThrow();
    });

    it('SHIELD 값이 아닌 SPECIAL 카드는 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        value: 'EVADE',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 2,
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
        attackStack: 2,
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
    it('SHIELD SPECIAL 카드만 지원해야 한다', () => {
      expect(
        validator.supports(createMockCard({
          type: CardType.SPECIAL,
          value: 'SHIELD',
        })),
      ).toBe(true);

      expect(
        validator.supports(createMockCard({
          type: CardType.SPECIAL,
          value: 'EVADE',
        })),
      ).toBe(false);

      expect(
        validator.supports(createMockCard({
          type: CardType.ATTACK,
          value: 'SWORD_1',
          power: 1,
        })),
      ).toBe(false);
    });
  });
});
