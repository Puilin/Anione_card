import { Server } from 'socket.io';

import {
  CardSuit,
  CardType,
  GameDirection,
  GameStatus,
} from 'src/shared/enums/game.enum';
import { GameRoom } from 'src/shared/interfaces/game.interface';

import { MaskingService } from './masking.service';
import { RoomBroadcastSerializer } from './room-broadcast.serializer';
import { SocketEvent } from 'src/shared/enums/socket-event.enum';

describe('RoomBroadcastSerializer', () => {
  let serializer: RoomBroadcastSerializer;

  beforeEach(() => {
    serializer = new RoomBroadcastSerializer(new MaskingService());
  });

  it('유저 기준으로 room을 직렬화할 때 본인 hand만 유지해야 한다', () => {
    const room = createRoom();

    const result = serializer.serializeRoomForUser(room, 'me');

    const me = result.players.find((player) => player.userId === 'me');
    const other = result.players.find((player) => player.userId === 'other');
    const spectator = result.players.find((player) => player.userId === 'spec');

    expect(me?.hand).toHaveLength(1);
    expect(other?.hand).toEqual([]);
    expect(spectator?.hand).toEqual([]);
    expect(result).not.toHaveProperty('drawPile');
    expect(result).not.toHaveProperty('discardPile');
  });

  it('shared room을 직렬화할 때 모든 hand와 lastCard를 제거해야 한다', () => {
    const room = createRoom();

    const result = serializer.serializeRoom(room);

    expect(result).not.toHaveProperty('lastCard');
    expect(
      (result.players as Array<Record<string, unknown>>).every(
        (player) => !('hand' in player),
      ),
    ).toBe(true);
    expect(result).not.toHaveProperty('drawPile');
    expect(result).not.toHaveProperty('discardPile');
  });

  it('ROOM_UPDATED broadcast 시 유저별 마스킹된 payload를 전송해야 한다', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const server = { to } as unknown as Server;
    const room = createRoom();

    serializer.broadcastRoomUpdated(server, room, 'room updated');

    expect(to).toHaveBeenNthCalledWith(1, 'user:me');
    expect(to).toHaveBeenNthCalledWith(2, 'user:other');
    expect(to).toHaveBeenNthCalledWith(3, 'user:spec');

    expect(emit).toHaveBeenNthCalledWith(
      1,
      SocketEvent.ROOM_UPDATED,
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          message: 'room updated',
          room: expect.objectContaining({
            players: expect.arrayContaining([
              expect.objectContaining({
                userId: 'me',
                hand: expect.arrayContaining([
                  expect.objectContaining({ id: 'me-card' }),
                ]),
              }),
              expect.objectContaining({
                userId: 'other',
                hand: [],
              }),
            ]),
          }),
        }),
        timestamp: expect.any(Number),
      }),
    );

    expect(emit).toHaveBeenNthCalledWith(
      2,
      SocketEvent.ROOM_UPDATED,
      expect.objectContaining({
        data: expect.objectContaining({
          room: expect.objectContaining({
            players: expect.arrayContaining([
              expect.objectContaining({
                userId: 'me',
                hand: [],
              }),
              expect.objectContaining({
                userId: 'other',
                hand: expect.arrayContaining([
                  expect.objectContaining({ id: 'other-card' }),
                ]),
              }),
            ]),
          }),
        }),
      }),
    );
  });

  it('shared ROOM_UPDATED broadcast 시 모든 hand와 lastCard를 제거한 payload를 전송해야 한다', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const server = { to } as unknown as Server;
    const room = createRoom();

    serializer.broadcastSharedRoomUpdated(server, room, 'shared update');

    expect(to).toHaveBeenCalledWith('room-1');
    expect(emit).toHaveBeenCalledWith(
      SocketEvent.ROOM_UPDATED,
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          message: 'shared update',
          room: expect.objectContaining({
            players: expect.arrayContaining([
              expect.objectContaining({
                userId: 'me',
              }),
              expect.objectContaining({
                userId: 'other',
              }),
            ]),
          }),
        }),
        timestamp: expect.any(Number),
      }),
    );
    expect(emit.mock.calls[0]?.[1]?.data?.room).not.toHaveProperty('lastCard');
    expect(
      emit.mock.calls[0]?.[1]?.data?.room.players.every(
        (player: Record<string, unknown>) => !('hand' in player),
      ),
    ).toBe(true);
  });
});

function createRoom(): GameRoom {
  return {
    roomId: 'room-1',
    hostId: 'me',
    attackStack: 0,
    currentPower: 0,
    lastCard: {
      id: 'last-card',
      suit: CardSuit.DOG,
      declaredSuit: CardSuit.DOG,
      type: CardType.NUMBER,
      value: '1',
      power: 0,
      assetKey: 'dog_1',
    },
    drawPile: [
      {
        id: 'draw-card',
        suit: CardSuit.CAT,
        declaredSuit: CardSuit.CAT,
        type: CardType.NUMBER,
        value: '2',
        power: 0,
        assetKey: 'cat_2',
      },
    ],
    discardPile: [],
    lastActionId: 3,
    turnOwner: 'me',
    isBonusTurn: false,
    direction: GameDirection.CLOCKWISE,
    players: [
      {
        userId: 'me',
        nickname: 'me',
        isGuest: false,
        hand: [
          {
            id: 'me-card',
            suit: CardSuit.RABBIT,
            declaredSuit: CardSuit.RABBIT,
            type: CardType.NUMBER,
            value: '3',
            power: 0,
            assetKey: 'rabbit_3',
          },
        ],
        cardCount: 1,
        isReady: true,
        isConnected: true,
        disconnectedAt: null,
        isOut: false,
        role: 'PLAYER',
      },
      {
        userId: 'other',
        nickname: 'other',
        isGuest: false,
        hand: [
          {
            id: 'other-card',
            suit: CardSuit.BEAR,
            declaredSuit: CardSuit.BEAR,
            type: CardType.NUMBER,
            value: '4',
            power: 0,
            assetKey: 'bear_4',
          },
        ],
        cardCount: 1,
        isReady: true,
        isConnected: true,
        disconnectedAt: null,
        isOut: false,
        role: 'PLAYER',
      },
      {
        userId: 'spec',
        nickname: 'spec',
        isGuest: true,
        hand: [
          {
            id: 'spec-card',
            suit: CardSuit.CAT,
            declaredSuit: CardSuit.CAT,
            type: CardType.NUMBER,
            value: '5',
            power: 0,
            assetKey: 'cat_5',
          },
        ],
        cardCount: 1,
        isReady: false,
        isConnected: true,
        disconnectedAt: null,
        isOut: false,
        role: 'SPECTATOR',
      },
    ],
    status: GameStatus.PLAYING,
    winnerId: null,
    winReason: null,
    recentLogs: [],
  };
}
