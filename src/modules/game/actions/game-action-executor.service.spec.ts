import { createMock } from '@golevelup/ts-jest';
import { WsException } from '@nestjs/websockets';
import { v4 as uuidv4 } from 'uuid';

import { GameActionExecutorService } from './game-action-executor.service';
import { GameService } from '../game.service';
import { RoomService } from 'src/modules/socket/room.service';
import { GameActionType } from 'src/shared/enums/game-action-type.enum';
import { GameErrorCode } from 'src/shared/enums/game-error-code.enum';
import { CardSuit, CardType, GameDirection } from 'src/shared/enums/game.enum';
import { Card, GameRoom, Player } from 'src/shared/interfaces/game.interface';

describe('GameActionExecutorService', () => {
  let executor: GameActionExecutorService;
  let roomService: jest.Mocked<RoomService>;
  let gameService: jest.Mocked<GameService>;
  let room: GameRoom;
  let host: Player;
  let guest: Player;

  beforeEach(() => {
    roomService = createMock<RoomService>();
    gameService = createMock<GameService>();

    executor = new GameActionExecutorService(
      roomService,
      gameService,
    );

    host = createPlayer('host-1');
    guest = createPlayer('guest-1');
    room = createRoom(host, guest);

    roomService.getRoom.mockReturnValue(room);
    gameService.playCard.mockReturnValue(room);
    gameService.drawCard.mockReturnValue(room);
  });

  it('PLAY_CARD 실행 전 expectedActionId를 검증하고 성공 시 lastActionId를 증가시켜야 한다', async () => {
    await executor.execute({
      type: GameActionType.PLAY_CARD,
      roomId: room.roomId,
      userId: host.userId,
      expectedActionId: 3,
      cardId: 'card-1',
      chosenSuit: CardSuit.CAT,
    });

    expect(gameService.playCard).toHaveBeenCalledWith(
      host.userId,
      'card-1',
      CardSuit.CAT,
    );
    expect(room.lastActionId).toBe(4);
  });

  it('DRAW_CARD도 턴을 다시 검증하고 성공 시 lastActionId를 증가시켜야 한다', async () => {
    await executor.execute({
      type: GameActionType.DRAW_CARD,
      roomId: room.roomId,
      userId: host.userId,
      expectedActionId: 3,
    });

    expect(gameService.drawCard).toHaveBeenCalledWith(
      host.userId,
      room.roomId,
    );
    expect(room.lastActionId).toBe(4);
  });

  it('expectedActionId가 다르면 GAME_STATE_OUTDATED를 반환하고 서비스를 호출하지 않아야 한다', async () => {
    const execution = executor.execute({
      type: GameActionType.DRAW_CARD,
      roomId: room.roomId,
      userId: host.userId,
      expectedActionId: 2,
    });

    try {
      await execution;
      fail('expected execution to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(WsException);
      expect((error as WsException).getError()).toEqual({
        code: GameErrorCode.GAME_STATE_OUTDATED,
        message: 'Game state is outdated',
      });
    }

    expect(gameService.drawCard).not.toHaveBeenCalled();
    expect(room.lastActionId).toBe(3);
  });

  it('Guard를 통과했더라도 실행 직전 턴이 바뀌었으면 실패해야 한다', async () => {
    room.turnOwner = guest.userId;

    await expect(
      executor.execute({
        type: GameActionType.PLAY_CARD,
        roomId: room.roomId,
        userId: host.userId,
        expectedActionId: 3,
        cardId: 'card-1',
      }),
    ).rejects.toThrow(new WsException('Not your turn'));

    expect(gameService.playCard).not.toHaveBeenCalled();
    expect(room.lastActionId).toBe(3);
  });
});

function createRoom(host: Player, guest: Player): GameRoom {
  return {
    roomId: uuidv4(),
    hostId: host.userId,
    attackStack: 0,
    currentPower: 0,
    lastCard: createCard(),
    drawPile: [],
    discardPile: [],
    lastActionId: 3,
    turnOwner: host.userId,
    isBonusTurn: false,
    direction: GameDirection.CLOCKWISE,
    players: [host, guest],
    status: 'PLAYING',
    recentLogs: [],
  };
}

function createPlayer(userId: string): Player {
  return {
    userId,
    nickname: userId,
    isGuest: false,
    hand: [],
    cardCount: 0,
    isReady: true,
    isOut: false,
    role: 'PLAYER',
  };
}

function createCard(overrides?: Partial<Card>): Card {
  return {
    id: uuidv4(),
    suit: CardSuit.RABBIT,
    declaredSuit: CardSuit.RABBIT,
    type: CardType.NUMBER,
    value: '1',
    power: 0,
    assetKey: 'rabbit_1',
    ...overrides,
  };
}
