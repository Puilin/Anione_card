import { CardSuit, CardType, GameDirection } from "src/shared/enums/game.enum";
import { Card, GameRoom } from "src/shared/interfaces/game.interface";
import { v4 as uuidv4 } from 'uuid';
import { MaskingService } from "./masking.service";

describe('MaskingService', () => {
  let service: MaskingService;

  const meId = 'me';
  const otherId = 'other';

  let room: GameRoom;

  beforeEach(() => {
    service = new MaskingService();

    room = {
      roomId: 'room-1',
      hostId: meId,
      attackStack: 0,
      currentPower: 0,
      lastCard: null,
      drawPile: [],
      discardPile: [],
      lastActionId: 0,
      turnOwner: meId,
      isBonusTurn: false,
      direction: GameDirection.CLOCKWISE,
      status: 'PLAYING',
      recentLogs: [],
      players: [
        {
          userId: meId,
          nickname: 'me',
          isGuest: true,
          hand: Array.from({ length: 7 }, () => createMockCard()),
          cardCount: 7,
          isReady: true,
          isOut: false,
          role: 'PLAYER',
        },
        {
          userId: otherId,
          nickname: 'other',
          isGuest: true,
          hand: Array.from({ length: 7 }, () => createMockCard()),
          cardCount: 7,
          isReady: true,
          isOut: false,
          role: 'PLAYER',
        },
      ],
    };
  });

  it('자신의 hand는 그대로 노출되어야 한다', () => {
    const result = service.maskRoomForUser(room, meId);

    const me = result.players.find(p => p.userId === meId);

    expect(me?.hand.length).toBe(7);
    expect(me?.hand).toEqual(room.players[0].hand);
  });

  it('다른 플레이어의 hand는 숨겨져야 한다', () => {
    const result = service.maskRoomForUser(room, meId);

    const other = result.players.find(p => p.userId === otherId);

    expect(other?.hand).toEqual([]);
  });

  it('다른 플레이어의 cardCount는 유지되어야 한다', () => {
    const result = service.maskRoomForUser(room, meId);

    const other = result.players.find(p => p.userId === otherId);

    expect(other?.cardCount).toBe(7);
  });

  it('원본 room 객체는 변경되지 않아야 한다 (불변성 보장)', () => {
    const original = JSON.parse(JSON.stringify(room));

    service.maskRoomForUser(room, meId);

    expect(room).toEqual(original);
  });

  it('관전자는 모든 플레이어의 hand를 볼 수 없어야 한다', () => {
    // 관전자 추가
    room.players.push({
      userId: 'spec', nickname: 'spec', isGuest: true,
      hand: [], cardCount: 0, isReady: false, isOut: false, role: 'SPECTATOR',
    });

    const result = service.maskRoomForUser(room, 'spec');
    
    // 관전자를 제외한 실제 플레이어들 추출
    const players = result.players.filter(p => p.role === 'PLAYER');

    // 모든 플레이어의 패가 비어있는지 전수 조사
    players.forEach(player => {
      expect(player.hand).toEqual([]);
    });
  });

  it('자신이 관전자일 경우 자신의 hand도 볼 수 없어야 한다', () => {
    // 관전자 추가
    room.players.push({
      userId: 'spec',
      nickname: 'spec',
      isGuest: true,
      hand: Array.from({ length: 7 }, () => createMockCard()), // 일부러 넣어둠
      cardCount: 7,
      isReady: false,
      isOut: false,
      role: 'SPECTATOR',
    });

    const result = service.maskRoomForUser(room, 'spec');

    const me = result.players.find(p => p.userId === 'spec');

    expect(me?.hand).toEqual([]);
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
