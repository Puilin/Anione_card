import { WsException } from '@nestjs/websockets';

import { Card, GameRoom, Player } from 'src/shared/interfaces/game.interface';

export interface ValidateActionParams {
  room: GameRoom;
  player: Player;
}

/**
 * 모든 게임 액션의 공통 검증 베이스
 */
export abstract class BaseActionValidator {
  /**
   * validator 식별용
   */
  abstract supports(card: Card): boolean;

  /**
   * 공통 액션 검증
   */
  validateBase(
    params: ValidateActionParams,
  ): void {
    const { room, player } = params;

    this.validateGameStarted(room);
    this.validatePlayerTurn(room, player);
    this.validatePlayerState(player);
  }

  /**
   * 게임 시작 여부 검증
   */
  protected validateGameStarted(
    room: GameRoom,
  ): void {
    if (room.status !== 'PLAYING') {
      throw new WsException(
        'Game has not started',
      );
    }
  }

  /**
   * 현재 턴 플레이어인지 검증
   */
  protected validatePlayerTurn(
    room: GameRoom,
    player: Player,
  ): void {
    if (room.turnOwner !== player.userId) {
      throw new WsException(
        'Not player turn',
      );
    }
  }

  /**
   * 플레이 가능한 상태인지 검증
   */
  protected validatePlayerState(
    player: Player,
  ): void {
    if (player.isOut) {
      throw new WsException(
        'Player is already out',
      );
    }

    if (player.role === 'SPECTATOR') {
      throw new WsException(
        'Spectator cannot play',
      );
    }
  }
}
