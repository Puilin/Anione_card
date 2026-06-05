import { Card, GameRoom, Player } from 'src/shared/interfaces/game.interface';
import { CardType, GameDirection } from 'src/shared/enums/game.enum';
import { WsException } from '@nestjs/websockets';
import { v4 as uuidv4 } from 'uuid';
import { SocketData } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { LogType } from 'src/shared/enums/log.enum';
import { GameLog } from 'src/shared/interfaces/log.interface';
import { TurnManagerService } from 'src/modules/game/turn-manager.service';

@Injectable()
export class RoomService {
  // Key: roomId, Value: GameRoom
  private readonly rooms = new Map<string, GameRoom>();
  // 유저가 속한 방을 빠르게 찾기 위한 역방향 인덱스 (userId -> roomId)
  private readonly userToRoom = new Map<string, string>();

  private readonly MAX_CAPACITY = 4; // players + spectators 포함

  private readonly logger = new Logger(RoomService.name);

  constructor(
    private readonly turnManager: TurnManagerService,
  ) {}

  // roomId로 방 정보 조회
  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  // userId로 유저가 속한 방 조회
  getUserRoom(userId: string): string | undefined {
    return this.userToRoom.get(userId);
  }

  createRoom(user: SocketData['user']): GameRoom {
    // 유저가 이미 참여 중인 방이 있는지 확인
    const alreadyInRoom = this.getUserRoom(user.userId);

    if (alreadyInRoom) {
      throw new WsException('User already in a room. Please leave the current room before creating a new one.');
    }

    const roomId = uuidv4();

    const hostPlayer: Player = {
      userId: user.userId,
      nickname: user.nickname,
      isGuest: user.isGuest,
      hand: [],
      cardCount: 0,
      isReady: true, // 방장은 기본 준비 상태
      isOut: false,
      role: 'PLAYER',
    };

    const room: GameRoom = {
      roomId,
      hostId: user.userId,
      attackStack: 0,
      currentPower: 0,
      lastCard: null,
      drawPile: [],
      discardPile: [],
      lastActionId: 0,
      turnOwner: null,
      isBonusTurn: false,
      direction: GameDirection.CLOCKWISE,
      players: [hostPlayer],
      status: 'WAITING',
      recentLogs: [],
    };

    this.rooms.set(roomId, room);
    this.userToRoom.set(user.userId, roomId);

    return room;
  }

  joinRoom(roomId: string, user: SocketData['user']): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new WsException('Room not found');

    if (this.userToRoom.has(user.userId)) {
      throw new WsException('User already in a room');
    }

    const isPlaying = room.status === 'PLAYING';

    if (room.players.length >= this.MAX_CAPACITY) {
      throw new WsException('Room is full');
    }

    const role: Player['role'] = isPlaying ? 'SPECTATOR' : 'PLAYER';

    const newPlayer: Player = {
      userId: user.userId,
      nickname: user.nickname,
      isGuest: user.isGuest,
      hand: [],
      cardCount: 0,
      isReady: false,
      isOut: false,
      role,
    };

    room.players.push(newPlayer);
    this.userToRoom.set(user.userId, roomId);

    return room;
  }

  leaveRoom(userId: string): { room: GameRoom | null, roomId: string | null, isDeleted: boolean } {
    const roomId = this.userToRoom.get(userId);
    if (!roomId) {
      this.logger.debug('leaveRoom skipped: User is not in any room');
      return { room: null, roomId: null, isDeleted: false };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.logger.debug('leaveRoom skipped: Room not found. Maybe already deleted?');
      return { room: null, roomId: null, isDeleted: false };
    }

    const leavingIndex = room.players.findIndex(p => p.userId === userId);
    if (leavingIndex === -1) {
      this.logger.warn(`leaveRoom skipped: There is an inconsistency 
        - userToRoom index exists but user not found in room players`);
      return { room: null, roomId: null, isDeleted: false };
    }

    const isTurnOwner = room.turnOwner === userId;
    const remainingPlayers = room.players.filter(
      (player) => player.userId !== userId,
    );

    let nextTurnOwner: string | null = null;

    if (room.status === 'PLAYING' && isTurnOwner) {
      nextTurnOwner =
        this.turnManager.resolveTurnAfterLeave({
          room,
          currentTurnOwnerId: userId,
          remainingPlayers,
        });
    }

    // 유저 제거
    room.players.splice(leavingIndex, 1);
    this.userToRoom.delete(userId);

    // 방이 비었으면 삭제
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return { room: null, roomId: roomId, isDeleted: true };
    }

    // 방장 위임
    if (room.hostId === userId) {
      const nextHost =
        room.players.find(p => p.role === 'PLAYER') ??
        room.players[0];
      nextHost.isReady = true; // 새 방장은 준비 상태로 전환

      room.hostId = nextHost.userId;
    }

    // 턴 처리
    if (nextTurnOwner) {
      room.turnOwner = nextTurnOwner;
    }

    return { room: room, roomId: roomId, isDeleted: false };
  }

  getNextTurnOwner(room: GameRoom, currentUserId: string): string {
    return this.turnManager.getNextActivePlayerId(
      room,
      currentUserId,
    );
  }

  toggleReady(userId: string): GameRoom {
    const roomId = this.userToRoom.get(userId);
    if (!roomId) {
      throw new WsException('User is not in any room');
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      throw new WsException('Room not found');
    }

    const player = room.players.find(p => p.userId === userId);
    if (!player) {
      throw new WsException('Player not found in room');
    }

    // 게임 중에는 변경 불가
    if (room.status === 'PLAYING') {
      throw new WsException('Cannot change ready state during game');
    }

    // 방장은 항상 ready
    if (room.hostId === userId) {
      throw new WsException('Host is always ready');
    }

    // 관전자는 변경 불가
    if (player.role !== 'PLAYER') {
      throw new WsException('Spectator cannot change ready state');
    }

    // 토글
    player.isReady = !player.isReady;

    return room;
  }

  createSystemLog(room: GameRoom, actorId: string, type: LogType, message: string) {
    const actor = room.players.find(p => p.userId === actorId);

    return {
      id: uuidv4(),
      type,
      actorId,
      actorName: actor?.nickname ?? 'Unknown',
      payload: { message },
      timestamp: Date.now(),
    };
  }

  pushLog(room: GameRoom, log: GameLog) {
    room.recentLogs.push(log);
    if (room.recentLogs.length > 5) {
      room.recentLogs.shift();
    }
  }
}
