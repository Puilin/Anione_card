import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

import {
  GameDirection,
} from 'src/shared/enums/game.enum';
import {
  GameRoom,
  Player,
} from 'src/shared/interfaces/game.interface';

import {
  ApplyTurnEffectParams,
  ResolveTurnAfterDrawParams,
  ResolveTurnAfterLeaveParams,
  TurnManager,
} from './turn-manager.interface';

@Injectable()
export class TurnManagerService implements TurnManager {
  pickFirstTurnOwner(room: GameRoom): string {
    const activePlayers =
      this.getActivePlayers(room);
    const randomIndex = Math.floor(
      Math.random() * activePlayers.length,
    );

    return activePlayers[randomIndex].userId;
  }

  getNextActivePlayerId(
    room: GameRoom,
    currentUserId: string,
    stepCount = 1,
  ): string {
    if (stepCount < 1) {
      throw new WsException(
        'stepCount must be greater than 0',
      );
    }

    let nextUserId = currentUserId;
    for (let i = 0; i < stepCount; i += 1) {
      nextUserId = this.getImmediateNextActivePlayerId(
        room,
        nextUserId,
      );
    }

    return nextUserId;
  }

  applyTurnEffect({
    room,
    playerId,
    effect,
  }: ApplyTurnEffectParams): string {
    if (effect.reverseDirection) {
      room.direction =
        room.direction ===
        GameDirection.CLOCKWISE
          ? GameDirection.COUNTER_CLOCKWISE
          : GameDirection.CLOCKWISE;
    }

    room.isBonusTurn = effect.bonusTurn;

    if (effect.keepTurn) {
      room.turnOwner = playerId;
      return playerId;
    }

    const nextTurnOwner =
      this.getNextActivePlayerId(
        room,
        playerId,
        effect.advanceSteps,
      );
    room.turnOwner = nextTurnOwner;

    return nextTurnOwner;
  }

  resolveTurnAfterDraw({
    room,
    player,
  }: ResolveTurnAfterDrawParams): string {
    const nextTurnOwner =
      this.getNextActivePlayerId(
        room,
        player.userId,
      );
    room.turnOwner = nextTurnOwner;

    return nextTurnOwner;
  }

  resolveTurnAfterLeave({
    room,
    currentTurnOwnerId,
    remainingPlayers,
  }: ResolveTurnAfterLeaveParams): string | null {
    if (
      room.status !== 'PLAYING' ||
      room.turnOwner !== currentTurnOwnerId
    ) {
      return null;
    }

    const activeRemainingPlayers =
      remainingPlayers.filter(
        (player) =>
          player.role === 'PLAYER' &&
          !player.isOut,
      );

    if (activeRemainingPlayers.length === 0) {
      return null;
    }

    if (activeRemainingPlayers.length === 1) {
      return activeRemainingPlayers[0].userId;
    }

    const nextRemainingPlayer =
      this.findNextRemainingPlayer(
        room,
        currentTurnOwnerId,
        activeRemainingPlayers,
      );

    if (nextRemainingPlayer) {
      return nextRemainingPlayer.userId;
    }

    return this.getNextActivePlayerId(
      room,
      currentTurnOwnerId,
    );
  }

  private findNextRemainingPlayer(
    room: GameRoom,
    currentTurnOwnerId: string,
    remainingPlayers: Player[],
  ): Player | null {
    const remainingPlayerIds =
      new Set(
        remainingPlayers.map(
          (player) => player.userId,
        ),
      );
    const currentIndex = room.players.findIndex(
      (player) =>
        player.userId === currentTurnOwnerId,
    );

    if (currentIndex === -1) {
      throw new WsException(
        'Current turn owner not found in room order',
      );
    }

    const orderedPlayers = room.players;
    const totalPlayers = orderedPlayers.length;

    for (let step = 1; step <= totalPlayers; step += 1) {
      const nextIndex =
        (currentIndex +
          room.direction * step +
          totalPlayers) %
        totalPlayers;
      const candidate =
        orderedPlayers[nextIndex];

      if (
        candidate &&
        remainingPlayerIds.has(
          candidate.userId,
        )
      ) {
        return candidate;
      }
    }

    return null;
  }

  private getImmediateNextActivePlayerId(
    room: GameRoom,
    currentUserId: string,
  ): string {
    const activePlayers =
      this.getActivePlayers(room);

    if (activePlayers.length === 1) {
      return activePlayers[0].userId;
    }

    const index = activePlayers.findIndex(
      (player) =>
        player.userId === currentUserId,
    );

    if (index === -1) {
      throw new WsException(
        'Invalid user',
      );
    }

    const nextIndex =
      (index +
        room.direction +
        activePlayers.length) %
      activePlayers.length;

    return activePlayers[nextIndex].userId;
  }

  private getActivePlayers(
    room: GameRoom,
  ): Player[] {
    const activePlayers = room.players.filter(
      (player) =>
        player.role === 'PLAYER' &&
        !player.isOut,
    );

    if (activePlayers.length === 0) {
      throw new WsException(
        'No active players',
      );
    }

    return activePlayers;
  }
}
