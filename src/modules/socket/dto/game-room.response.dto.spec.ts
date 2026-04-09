import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { GameRoomResponseDto } from './game-room.response.dto';
import { CardSuit, CardType, GameDirection } from 'src/shared/enums/game.enum';
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
      status: 'PLAYING',
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

});

function createMockCard(overrides?: Partial<Card>): Card {
  return {
    id: uuidv4(),
    suit: CardSuit.RABBIT,
    type: CardType.NUMBER,
    value: '1',
    power: 0,
    assetKey: 'rabbit_number_1',
    ...overrides,
  };
}