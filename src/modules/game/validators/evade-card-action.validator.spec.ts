import { WsException } from '@nestjs/websockets';

import {
  CardSuit,
  CardType,
} from 'src/shared/enums/game.enum';

import {
  GameRoom,
} from 'src/shared/interfaces/game.interface';

import { EvadeCardValidator } from './evade-card-action.validator';
import { createSpecialValidatorFixtures } from './special-card-validator.spec.fixture';

describe('EvadeCardValidator', () => {
  let validator: EvadeCardValidator;

  beforeEach(() => {
    validator = new EvadeCardValidator();
  });

  const {
    createMockCard,
    createMockPlayer,
    createMockRoom,
  } = createSpecialValidatorFixtures(
    'EVADE',
    'rabbit_evade',
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

    it('공격 수치와 관계없이 EVADE는 공격을 회피할 수 있어야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
      });

      const player = createMockPlayer({
        hand: [card],
      });

      const room = createMockRoom({
        attackStack: 7,
        lastCard: createMockCard({
          id: 'last-card',
          suit: CardSuit.BEAR,
          value: 'SWORD_3',
          type: CardType.ATTACK,
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

    it('공격 스택이 없어도 바닥 카드가 EVADE면 성공해야 한다', () => {
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
          value: 'EVADE',
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

    it('공격 스택이 없고 바닥 카드가 EVADE도 아니며 문양도 다르면 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        suit: CardSuit.CAT,
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

    it('EVADE 값이 아닌 SPECIAL 카드는 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        value: 'SHIELD',
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
    it('EVADE SPECIAL 카드만 지원해야 한다', () => {
      expect(
        validator.supports(createMockCard({
          type: CardType.SPECIAL,
          value: 'EVADE',
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
          type: CardType.ATTACK,
          value: 'SWORD_3',
          power: 3,
        })),
      ).toBe(false);
    });
  });
});
