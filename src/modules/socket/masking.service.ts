import { Injectable } from '@nestjs/common';
import { GameRoom } from 'src/shared/interfaces/game.interface';

@Injectable()
export class MaskingService {

  maskRoomForUser(room: GameRoom, userId: string): GameRoom {
    return {
      ...room,
      players: room.players.map(player => {
        const isMe = player.userId === userId;
        const isSpectator = player.role === 'SPECTATOR';

        // 관전자거나, 다른 플레이어면 hand 숨김
        if (isSpectator || !isMe) {
          return {
            ...player,
            hand: [],
          };
        }

        // 나 자신이면 그대로
        return { ...player };
      }),
    };
  }
}