import { Injectable } from '@nestjs/common';

import { GameRoom, Player } from 'src/shared/interfaces/game.interface';
import { VictoryTrigger, WinReason } from 'src/shared/enums/game.enum';

export type VictoryContext = {
  room: GameRoom;
  trigger: VictoryTrigger;
  actorId?: string;
};

export type VictoryResult = {
  winner: Player;
  reason: WinReason;
} | null;

@Injectable()
export class VictoryService {
  determineWinner(
    context: VictoryContext,
  ): VictoryResult {
    switch (context.trigger) {
      case VictoryTrigger.CARD_PLAYED:
        return this.determineEmptyHandWinner(
          context.room,
        );
      case VictoryTrigger.PLAYER_LEFT:
        return this.determineLastPlayerWinner(
          context.room,
        );
      default:
        return null;
    }
  }

  private determineEmptyHandWinner(
    room: GameRoom,
  ): VictoryResult {
    const winner =
      this.getActivePlayers(room).find(
        (player) => player.hand.length === 0,
      ) ?? null;

    if (!winner) {
      return null;
    }

    return {
      winner,
      reason: WinReason.EMPTY_HAND,
    };
  }

  private determineLastPlayerWinner(
    room: GameRoom,
  ): VictoryResult {
    if (room.status !== 'PLAYING') {
      return null;
    }

    const activePlayers =
      this.getActivePlayers(room);

    if (activePlayers.length !== 1) {
      return null;
    }

    return {
      winner: activePlayers[0],
      reason: WinReason.PLAYER_LEAVE,
    };
  }

  private getActivePlayers(
    room: GameRoom,
  ): Player[] {
    return room.players.filter(
      (player) =>
        player.role === 'PLAYER' &&
        !player.isOut,
    );
  }
}
