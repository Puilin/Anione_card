import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Server } from 'socket.io';

import { SocketEvent } from 'src/shared/enums/socket-event.enum';
import { GameRoom } from 'src/shared/interfaces/game.interface';

import { GameRoomResponseDto } from './dto/game-room.response.dto';
import { MaskingService } from './masking.service';

@Injectable()
export class RoomBroadcastSerializer {
  constructor(
    private readonly maskingService: MaskingService,
  ) {}

  serializeRoom(room: GameRoom): Record<string, unknown> {
    const serializedRoom = plainToInstance(GameRoomResponseDto, room, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });

    const sharedRoom = {
      ...serializedRoom,
      players: serializedRoom.players.map((player) => {
        const { hand: _hand, ...safePlayer } = player;
        return safePlayer;
      }),
    } as Record<string, unknown>;

    delete sharedRoom.lastCard;

    return sharedRoom;
  }

  serializeRoomForUser(
    room: GameRoom,
    userId: string,
  ): GameRoomResponseDto {
    const maskedRoom = this.maskingService.maskRoomForUser(room, userId);

    return plainToInstance(GameRoomResponseDto, maskedRoom, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  broadcastRoomUpdated(
    server: Server,
    room: GameRoom,
    message: string,
  ): void {
    for (const player of room.players) {
      server
        .to(this.getUserChannel(player.userId))
        .emit(SocketEvent.ROOM_UPDATED, {
          success: true,
          data: {
            room: this.serializeRoomForUser(room, player.userId),
            message,
          },
          timestamp: Date.now(),
        });
    }
  }

  broadcastSharedRoomUpdated(
    server: Server,
    room: GameRoom,
    message: string,
  ): void {
    server.to(room.roomId).emit(SocketEvent.ROOM_UPDATED, {
      success: true,
      data: {
        room: this.serializeRoom(room),
        message,
      },
      timestamp: Date.now(),
    });
  }

  getUserChannel(userId: string): string {
    return `user:${userId}`;
  }
}
