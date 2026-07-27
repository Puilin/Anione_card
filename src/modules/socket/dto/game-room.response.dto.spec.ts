import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { GameRoomResponseDto } from './game-room.response.dto';
import {
  CardSuit,
  CardType,
  GameDirection,
  GameStatus,
  WinReason,
} from 'src/shared/enums/game.enum';
import { GameRoom, Card } from 'src/shared/interfaces/game.interface';
import { v4 as uuidv4 } from 'uuid';

describe('GameRoomResponseDto', () => {

  it('drawPile과 discardPile은 직렬화 시 제외되어야 한다', () => {
    const room: GameRoom = {
      roomId: 'room-1',
      hostId: 'me',
      attackStack: 0,
      currentPower: 0,
      lastCard: createMockCard(),
      drawPile: [createMockCard()],
      discardPile: [createMockCard()],
      lastActionId: 0,
      turnOwner: 'me',
      isBonusTurn: false,
      direction: GameDirection.CLOCKWISE,
      status: GameStatus.PLAYING,
      winnerId: null,
      winReason: null,
      recentLogs: [],
      players: [],
    };

    const dto = plainToInstance(GameRoomResponseDto, room, {
      excludeExtraneousValues: true,
    });

    // 핵심 검증
    expect((dto as any).drawPile).toBeUndefined();
    expect((dto as any).discardPile).toBeUndefined();

    // 추가적으로 안전하게 JSON 기준 검증
    const serialized = JSON.parse(JSON.stringify(dto));

    expect(serialized.drawPile).toBeUndefined();
    expect(serialized.discardPile).toBeUndefined();
  });

  it('lastActionId는 직렬화 시 포함되어야 한다', () => {
    const room: GameRoom = {
      roomId: 'room-1',
      hostId: 'me',
      attackStack: 0,
      currentPower: 0,
      lastCard: createMockCard(),
      drawPile: [],
      discardPile: [],
      lastActionId: 7,
      turnOwner: 'me',
      isBonusTurn: false,
      direction: GameDirection.CLOCKWISE,
      status: GameStatus.PLAYING,
      winnerId: null,
      winReason: null,
      recentLogs: [],
      players: [],
    };

    const dto = plainToInstance(GameRoomResponseDto, room, {
      excludeExtraneousValues: true,
    });
    const serialized = JSON.parse(JSON.stringify(dto));

    expect(serialized.lastActionId).toBe(7);
  });

  it('Snapshot 복구 필드는 직렬화 시 포함되어야 한다', () => {
    const room: GameRoom = {
      roomId: 'room-1',
      hostId: 'host-1',
      attackStack: 4,
      currentPower: 2,
      lastCard: createMockCard({
        suit: CardSuit.BEAR,
        declaredSuit: CardSuit.CAT,
      }),
      drawPile: [],
      discardPile: [],
      lastActionId: 7,
      turnOwner: 'me',
      isBonusTurn: false,
      direction: GameDirection.CLOCKWISE,
      status: GameStatus.PLAYING,
      winnerId: null,
      winReason: null,
      recentLogs: [],
      players: [
        {
          userId: 'me',
          nickname: 'me',
          isGuest: false,
          hand: [createMockCard()],
          cardCount: 1,
          isReady: true,
          isConnected: false,
          disconnectedAt: 1234567890,
          isOut: false,
          role: 'PLAYER',
        },
      ],
    };

    const dto = plainToInstance(GameRoomResponseDto, room, {
      excludeExtraneousValues: true,
    });
    const serialized = JSON.parse(JSON.stringify(dto));

    expect(serialized.hostId).toBe('host-1');
    expect(serialized.currentPower).toBe(2);
    expect(serialized.lastCard.declaredSuit).toBe(CardSuit.CAT);
    expect(serialized.players[0].isReady).toBe(true);
    expect(serialized.players[0].isConnected).toBe(false);
    expect(serialized.players[0].disconnectedAt).toBe(1234567890);
  });

  it('게임 종료 정보는 직렬화 시 포함되어야 한다', () => {
    const room: GameRoom = {
      roomId: 'room-1',
      hostId: 'me',
      attackStack: 0,
      currentPower: 0,
      lastCard: createMockCard(),
      drawPile: [],
      discardPile: [],
      lastActionId: 7,
      turnOwner: null,
      isBonusTurn: false,
      direction: GameDirection.CLOCKWISE,
      status: GameStatus.FINISHED,
      winnerId: 'winner-1',
      winReason: WinReason.EMPTY_HAND,
      recentLogs: [],
      players: [],
    };

    const dto = plainToInstance(GameRoomResponseDto, room, {
      excludeExtraneousValues: true,
    });
    const serialized = JSON.parse(JSON.stringify(dto));

    expect(serialized.status).toBe(GameStatus.FINISHED);
    expect(serialized.winnerId).toBe('winner-1');
    expect(serialized.winReason).toBe(WinReason.EMPTY_HAND);
  });

});

function createMockCard(overrides?: Partial<Card>): Card {
  const suit = overrides?.suit ?? CardSuit.RABBIT;
  return {
    id: uuidv4(),
    suit,
    declaredSuit: overrides?.declaredSuit ?? suit,
    type: CardType.NUMBER,
    value: '1',
    power: 0,
    assetKey: 'rabbit_number_1',
    ...overrides,
  };
}
