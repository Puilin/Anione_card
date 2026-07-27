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

import {
  CardActionValidator,
  ValidateCardActionParams,
} from './card-action.validator';

describe('CardActionValidator', () => {
  class TestCardValidator extends CardActionValidator {
    supports(_card: Card): boolean {
      return true;
    }

    protected validateRule(): void {
      // no-op
    }
  }

  let validator: TestCardValidator;

  beforeEach(() => {
    validator = new TestCardValidator();
  });

  const createMockCard = (overrides: Partial<Card> = {}): Card => ({
    id: 'card-1',
    suit: CardSuit.RABBIT,
    declaredSuit: overrides.declaredSuit ?? overrides.suit ?? CardSuit.RABBIT,
    value: '1',
    type: CardType.NUMBER,
    power: 0,
    assetKey: 'rabbit_1',
    ...overrides,
  });

  const createMockPlayer = (overrides: Partial<Player> = {}): Player => ({
    userId: 'user-1',
    nickname: 'tester',
    role: 'PLAYER',
    isGuest: false,
    isOut: false,
    isReady: true,
    isConnected: true,
    cardCount: 1,
    hand: [createMockCard()],
    ...overrides,
  });

  const createMockRoom = (overrides: Partial<GameRoom> = {}): GameRoom => ({
    roomId: 'room-1',
    hostId: 'user-1',
    status: 'PLAYING',
    turnOwner: 'user-1',
    players: [],
    lastCard: createMockCard({id: 'card-2'}),
    ...overrides,
  }) as GameRoom;

  describe('validate', () => {
    it('모든 검증이 통과하면 성공해야 한다', () => {
      const player = createMockPlayer();

      const room = createMockRoom({
        players: [player],
        turnOwner: player.userId,
      });

      const card = player.hand[0];

      expect(() =>
        validator.validate({
          room,
          player,
          card,
        }),
      ).not.toThrow();
    });

    it('플레이어가 소유하지 않은 카드면 예외를 던져야 한다', () => {
      const player = createMockPlayer();

      const room = createMockRoom({
        players: [player],
      });

      const card = createMockCard({
        id: 'card-3',
      });

      expect(() =>
        validator.validate({
          room,
          player,
          card,
        }),
      ).toThrow(WsException);
    });
  });
});
