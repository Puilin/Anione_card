import { WsException } from '@nestjs/websockets';

import {
  CardSuit,
  CardType,
} from 'src/shared/enums/game.enum';
import {
  Card,
  GameRoom,
} from 'src/shared/interfaces/game.interface';

import {
  AbstractSpecialCardValidator,
  SpecialCardRuleContext,
} from './abstract-special-card.validator';
import { createSpecialValidatorFixtures } from './special-card-validator.spec.fixture';

describe('AbstractSpecialCardValidator', () => {
  class TestSpecialValidator extends AbstractSpecialCardValidator {
    protected readonly specialValue = 'TEST_SPECIAL';

    attackStackCalled = 0;
    noAttackStackCalled = 0;
    canPlayInAttackStack = true;
    canPlayInNoAttackStack = true;

    protected canPlayWhenAttackStack(
      _ctx: SpecialCardRuleContext,
    ): boolean {
      this.attackStackCalled += 1;
      return this.canPlayInAttackStack;
    }

    protected canPlayWhenNoAttackStack(
      _ctx: SpecialCardRuleContext,
    ): boolean {
      this.noAttackStackCalled += 1;
      return this.canPlayInNoAttackStack;
    }

    protected getInvalidPlayMessage(): string {
      return 'Cannot play test special card in current state';
    }
  }

  let validator: TestSpecialValidator;
  const {
    createMockCard,
    createMockPlayer,
    createMockRoom,
  } = createSpecialValidatorFixtures(
    'TEST_SPECIAL',
    'rabbit_test_special',
  );

  beforeEach(() => {
    validator = new TestSpecialValidator();
  });

  describe('supports', () => {
    it('SPECIAL + specialValue일 때만 true여야 한다', () => {
      expect(
        validator.supports(createMockCard()),
      ).toBe(true);

      expect(
        validator.supports(createMockCard({
          value: 'BONUS',
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

  describe('validate', () => {
    it('lastCard가 없으면 실패해야 한다', () => {
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

    it('attackStack > 0이면 공격 스택 분기만 호출해야 한다', () => {
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
          suit: CardSuit.BEAR,
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
      ).not.toThrow();

      expect(
        validator.attackStackCalled,
      ).toBe(1);
      expect(
        validator.noAttackStackCalled,
      ).toBe(0);
    });

    it('attackStack === 0이면 비공격 분기만 호출해야 한다', () => {
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
      ).not.toThrow();

      expect(
        validator.attackStackCalled,
      ).toBe(0);
      expect(
        validator.noAttackStackCalled,
      ).toBe(1);
    });

    it('specialValue가 다르면 실패해야 한다', () => {
      const card = createMockCard({
        id: 'card-2',
        value: 'SHIELD',
      });
      const player = createMockPlayer({
        hand: [card],
      });
      const room = createMockRoom();

      expect(() =>
        validator.validate({
          room: room as GameRoom,
          player,
          card: card as Card,
        }),
      ).toThrow(WsException);
    });
  });
});
