import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

import { GameService } from '../game.service';
import { RoomService } from 'src/modules/socket/room.service';
import { GameActionExecutor } from './game-action-executor.interface';
import { GameActionType } from 'src/shared/enums/game-action-type.enum';
import { GameErrorCode } from 'src/shared/enums/game-error-code.enum';
import { GameAction } from 'src/shared/interfaces/game-action.interface';
import { GameRoom, Player } from 'src/shared/interfaces/game.interface';
import { GameStatus } from 'src/shared/enums/game.enum';

@Injectable()
export class GameActionExecutorService implements GameActionExecutor {
  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
  ) {}

  async execute(action: GameAction): Promise<void> {
    const room = this.getExecutableRoom(action);

    this.validateExpectedActionId(room, action.expectedActionId);

    const player = this.getExecutablePlayer(room, action.userId);
    this.validateTurnOwner(room, player.userId);

    switch (action.type) {
      case GameActionType.PLAY_CARD:
        this.gameService.playCard(
          action.userId,
          action.cardId,
          action.chosenSuit,
        );
        break;
      case GameActionType.DRAW_CARD:
        this.gameService.drawCard(
          action.userId,
          action.roomId,
        );
        break;
      default:
        this.assertUnreachable(action);
    }

    room.lastActionId += 1;
  }

  private getExecutableRoom(action: GameAction): GameRoom {
    const room = this.roomService.getRoom(action.roomId);

    if (!room) {
      throw new WsException('Room not found');
    }

    if (room.status === GameStatus.FINISHED) {
      throw new WsException('Game already finished');
    }

    if (room.status !== GameStatus.PLAYING) {
      throw new WsException('Game has not started');
    }

    return room;
  }

  private validateExpectedActionId(
    room: GameRoom,
    expectedActionId: number,
  ): void {
    if (room.lastActionId !== expectedActionId) {
      throw new WsException({
        code: GameErrorCode.GAME_STATE_OUTDATED,
        message: 'Game state is outdated',
      });
    }
  }

  private getExecutablePlayer(
    room: GameRoom,
    userId: string,
  ): Player {
    const player = room.players.find(
      (candidate) => candidate.userId === userId,
    );

    if (!player) {
      throw new WsException('User is not a participant of this room');
    }

    if (player.role === 'SPECTATOR') {
      throw new WsException('Spectator cannot play');
    }

    if (player.isOut) {
      throw new WsException('Player is already out');
    }

    return player;
  }

  private validateTurnOwner(
    room: GameRoom,
    userId: string,
  ): void {
    if (room.turnOwner !== userId) {
      throw new WsException('Not your turn');
    }
  }

  private assertUnreachable(action: never): never {
    throw new WsException(
      `Unsupported action type: ${(action as GameAction).type}`,
    );
  }
}
