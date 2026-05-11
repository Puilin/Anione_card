import { WsException } from '@nestjs/websockets';

import {
  CardSuit,
  CardType,
} from 'src/shared/enums/game.enum';
import { Card } from 'src/shared/interfaces/game.interface';

import { ActionValidator } from './action-validator.interface';
import { ActionValidatorRegistry } from './action-validator.registry';

describe('ActionValidatorRegistry', () => {
  const createMockCard = (
    overrides: Partial<Card> = {},
  ): Card => ({
    id: 'card-1',
    suit: CardSuit.RABBIT,
    value: 'JUMP',
    type: CardType.SPECIAL,
    power: 0,
    assetKey: 'rabbit_jump',
    ...overrides,
  });

  const createMockValidator = (
    supportsValue: boolean,
  ): ActionValidator => ({
    supports: jest.fn().mockReturnValue(
      supportsValue,
    ),
    validate: jest.fn(),
  });

  it('카드에 맞는 validator를 반환해야 한다', () => {
    const first = createMockValidator(
      false,
    );
    const second = createMockValidator(
      true,
    );

    const registry =
      new ActionValidatorRegistry([
        first,
        second,
      ]);

    const result = registry.getValidator(
      createMockCard(),
    );

    expect(result).toBe(second);
  });

  it('일치하는 validator가 없으면 예외를 던져야 한다', () => {
    const first = createMockValidator(
      false,
    );
    const second = createMockValidator(
      false,
    );

    const registry =
      new ActionValidatorRegistry([
        first,
        second,
      ]);

    expect(() =>
      registry.getValidator(
        createMockCard({
          value: 'UNKNOWN',
        }),
      ),
    ).toThrow(WsException);
  });

  it('일치하는 validator가 2개 이상이면 예외를 던져야 한다', () => {
    const first = createMockValidator(
      true,
    );
    const second = createMockValidator(
      true,
    );

    const registry =
      new ActionValidatorRegistry([
        first,
        second,
      ]);

    expect(() =>
      registry.getValidator(
        createMockCard(),
      ),
    ).toThrow(WsException);
  });
});
