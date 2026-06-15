import {
  CardSuit,
  CardType,
  GameDirection,
  GameStatus,
  VictoryTrigger,
  WinReason,
} from 'src/shared/enums/game.enum';
import { Card, GameRoom, Player } from 'src/shared/interfaces/game.interface';
import { VictoryService } from './victory.service';

describe('VictoryService', () => {
  let service: VictoryService;

  beforeEach(() => {
    service = new VictoryService();
  });

  it('손패가 0장인 활성 플레이어를 승자로 판정해야 한다', () => {
    const winner = createPlayer('winner', []);
    const room = createRoom([
      createPlayer('player-1', [createCard()]),
      winner,
    ]);

    expect(
      service.determineWinner({
        room,
        trigger: VictoryTrigger.CARD_PLAYED,
      }),
    ).toEqual({
      winner,
      reason: WinReason.EMPTY_HAND,
    });
  });

  it('관전자나 탈락자는 승리자로 판정하지 않아야 한다', () => {
    const room = createRoom([
      createPlayer('spectator', [], { role: 'SPECTATOR' }),
      createPlayer('out-player', [], { isOut: true }),
      createPlayer('player-1', [createCard()]),
    ]);

    expect(
      service.determineWinner({
        room,
        trigger: VictoryTrigger.CARD_PLAYED,
      }),
    ).toBeNull();
  });

  it('명시적 퇴장 후 활성 플레이어가 1명만 남으면 승리로 판정해야 한다', () => {
    const winner = createPlayer('winner', [createCard()]);
    const room = createRoom([
      winner,
      createPlayer('spectator', [], { role: 'SPECTATOR' }),
    ]);

    expect(
      service.determineWinner({
        room,
        trigger: VictoryTrigger.PLAYER_LEFT,
      }),
    ).toEqual({
      winner,
      reason: WinReason.PLAYER_LEAVE,
    });
  });

  it('퇴장 후 활성 플레이어가 2명 이상이면 승리로 판정하지 않아야 한다', () => {
    const room = createRoom([
      createPlayer('player-1', [createCard()]),
      createPlayer('player-2', [createCard()]),
    ]);

    expect(
      service.determineWinner({
        room,
        trigger: VictoryTrigger.PLAYER_LEFT,
      }),
    ).toBeNull();
  });
});

function createRoom(players: Player[]): GameRoom {
  return {
    roomId: 'room-1',
    hostId: players[0]?.userId ?? 'host',
    attackStack: 0,
    currentPower: 0,
    lastCard: createCard(),
    drawPile: [],
    discardPile: [],
    lastActionId: 0,
    turnOwner: players[0]?.userId ?? null,
    isBonusTurn: false,
    direction: GameDirection.CLOCKWISE,
    players,
    status: GameStatus.PLAYING,
    winnerId: null,
    winReason: null,
    recentLogs: [],
  };
}

function createPlayer(
  userId: string,
  hand: Card[],
  overrides: Partial<Player> = {},
): Player {
  return {
    userId,
    nickname: userId,
    isGuest: false,
    hand,
    cardCount: hand.length,
    isReady: true,
    isOut: false,
    role: 'PLAYER',
    ...overrides,
  };
}

function createCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    suit: CardSuit.RABBIT,
    declaredSuit: CardSuit.RABBIT,
    type: CardType.NUMBER,
    value: '1',
    power: 0,
    assetKey: 'rabbit_1',
    ...overrides,
  };
}
