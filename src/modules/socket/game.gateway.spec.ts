import { createMock } from '@golevelup/ts-jest';
import { WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { AuthService } from '../auth/auth.service';
import { GameService } from '../game/game.service';
import { SocketEvent } from 'src/shared/enums/socket-event.enum';
import { RoomService } from './room.service';
import { GameGateway } from './game.gateway';
import { GameRoom } from 'src/shared/interfaces/game.interface';
import { CardSuit, CardType } from 'src/shared/enums/game.enum';

describe('GameGateway', () => {
  let gateway: GameGateway;
  let authService: jest.Mocked<AuthService>;
  let roomService: jest.Mocked<RoomService>;
  let gameService: jest.Mocked<GameService>;

  beforeEach(() => {
    authService = createMock<AuthService>();
    roomService = createMock<RoomService>();
    gameService = createMock<GameService>();

    gateway = new GameGateway(
      authService,
      roomService,
      gameService,
    );
  });

  describe('handlePlayCard', () => {
    it('playCard 이벤트에서 GameService.playCard를 호출해야 한다', () => {
      const client = {
        data: {
          user: {
            userId: 'user-1',
            nickname: 'tester',
            isGuest: false,
          },
        },
      } as Socket;

      const updatedRoom: Partial<GameRoom> = {
        roomId: 'room-1',
        lastCard: {
          id: 'card-1',
          type: CardType.NUMBER,
          power: 0,
          suit: CardSuit.RABBIT,
          declaredSuit: CardSuit.RABBIT,
          value: '3',
          assetKey: 'rabbit_3',
        }
      };

      gameService.playCard.mockReturnValue(
        updatedRoom as GameRoom,
      );

      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({
        emit,
      });

      gateway.server = { to } as unknown as Server;

      const result = gateway.handlePlayCard(
        client,
        {
          roomId: 'room-1',
          cardId: 'card-1',
        },
      );

      expect(gameService.playCard).toHaveBeenCalledWith(
        'user-1',
        'card-1',
        undefined,
      );
      expect(to).toHaveBeenCalledWith(
        'room-1',
      );
      expect(emit).toHaveBeenCalledWith(
        SocketEvent.GAME_STATE_UPDATE,
        {
          message: `${client.data.user.nickname}님이 [${updatedRoom.lastCard?.suit} ${updatedRoom.lastCard?.value}] 카드를 냈습니다.`,
        }
      );
      expect(result).toBe(updatedRoom);
    });

    it('서비스에서 발생한 예외를 그대로 전파해야 한다', () => {
      const client = {
        data: {
          user: {
            userId: 'user-1',
            nickname: 'tester',
            isGuest: false,
          },
        },
      } as Socket;

      gameService.playCard.mockImplementation(
        () => {
          throw new WsException('play card failed');
        },
      );

      gateway.server = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      } as unknown as Server;

      expect(() =>
        gateway.handlePlayCard(
          client,
          {
            roomId: 'room-1',
            cardId: 'card-1',
          },
        ),
      ).toThrow(WsException);
    });
  });
});
