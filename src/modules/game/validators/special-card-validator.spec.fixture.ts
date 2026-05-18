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

export function createSpecialValidatorFixtures(
  specialValue: string,
  assetKey: string,
) {
  const createMockCard = (
    overrides: Partial<Card> = {},
  ): Card => ({
    id: 'card-1',
    suit: CardSuit.RABBIT,
    value: specialValue,
    type: CardType.SPECIAL,
    power: 0,
    assetKey,
    ...overrides,
  });

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
    direction: GameDirection.CLOCKWISE,
    attackStack: 0,
    isBonusTurn: false,
    players: [],
    lastCard: createMockCard({
      id: 'last-card',
      suit: CardSuit.RABBIT,
      value: '7',
      type: CardType.NUMBER,
    }),
    ...overrides,
  });

  return {
    createMockCard,
    createMockPlayer,
    createMockRoom,
  };
}
