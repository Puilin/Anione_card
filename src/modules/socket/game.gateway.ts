import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Inject, Logger, UseFilters, UseGuards, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket, SocketData } from 'socket.io';
import { ActionDto, JoinRoomDto, PlayCardDto } from './dto/game-room.dto';
import { SocketEvent } from 'src/shared/enums/socket-event.enum';
import { SocketAuthMiddleware } from './middlewares/auth.middleware';
import { WsExceptionFilter } from 'src/common/filters/ws-exception.filter';
import { AuthService } from '../auth/auth.service';
import { GameService } from '../game/game.service';
import { RoomService } from './room.service';
import { GameResponseInterceptor } from './interceptors/game-response.interceptor';
import { GameParticipantGuard } from 'src/common/guards/game-participant.guard';
import { TurnOwnerGuard } from 'src/common/guards/turnowner.guard';
import { RoomMasterGuard } from 'src/common/guards/room-master.guard';
import { MemberOnlyGuard } from 'src/common/guards/member-only.guard';
import { GAME_ACTION_QUEUE } from '../game/actions/game-action.token';
import { GameActionType } from 'src/shared/enums/game-action-type.enum';
import type { GameActionQueue } from '../game/actions/game-action-queue.interface';
import { VictoryService } from '../game/victory.service';
import { GameStatus, VictoryTrigger } from 'src/shared/enums/game.enum';
import { GameRoom } from 'src/shared/interfaces/game.interface';

// 기본 ValidationPipe는 HTTP 예외를 던지므로, WebSocket에 맞게 커스텀 설정
export const SocketValidationConfig = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: (errors) => {
    const messages = errors.map((err) => (err.constraints ? Object.values(err.constraints) : [])).flat();
    return new WsException(messages);
  },
});

@UseFilters(new WsExceptionFilter())
@UsePipes(SocketValidationConfig)
@WebSocketGateway({
  namespace: 'game', // 게임 채널 분리
  cors: { origin: '*' }, // 개발 편의를 위한 CORS 허용
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private logger: Logger = new Logger('GameGateway');
  private readonly disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly DISCONNECT_GRACE_MS = 30_000;

  constructor(
    private readonly authService: AuthService,
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly victoryService: VictoryService,
    @Inject(GAME_ACTION_QUEUE)
    private readonly gameActionQueue: GameActionQueue,
  ) {}

  @UseGuards(MemberOnlyGuard)
  @SubscribeMessage(SocketEvent.CREATE_ROOM)
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`[${SocketEvent.CREATE_ROOM}] 유저 ${client.data.user.nickname}(${client.data.user.userId})가 방 생성 시도`);
    const room = this.roomService.createRoom(client.data.user);

    // Socket.io의 'Room' 개념에 클라이언트를 넣어줍니다.
    client.join(room.roomId);

    client.emit('response', {
      status: SocketEvent.ROOM_CREATED,
      roomId: room.roomId,
    });
  }

  // 방 입장 (joinRoom)
  @SubscribeMessage(SocketEvent.JOIN_ROOM)
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
  ) {
    this.logger.log(`[${SocketEvent.JOIN_ROOM}] 유저 ${client.data.user.nickname}(${client.data.user.userId})가 방(${data.roomId}) 입장 시도`);
    const room = this.roomService.joinRoom(data.roomId, client.data.user);
    const joinedPlayer = room.players.find(
      (player) => player.userId === client.data.user.userId,
    );

    // Socket.io의 'Room' 개념에 클라이언트를 넣어줍니다.
    client.join(room.roomId);

    // 방에 있는 모든 사람(나 포함)에게 새로운 유저가 왔음을 알립니다.
    this.server.to(room.roomId).emit(SocketEvent.ROOM_UPDATED, {
      message: this.buildJoinRoomMessage(
        client.data.user.nickname,
        room.status,
        joinedPlayer?.role,
      ),
    });
  }

  // 방 퇴장 (leaveRoom)
  @UseGuards(GameParticipantGuard)
  @SubscribeMessage(SocketEvent.LEAVE_ROOM)
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
  ) {
    this.clearDisconnectTimeout(client.data.user.userId);

    const { room, roomId, isDeleted } = this.roomService.leaveRoom(client.data.user.userId);
    const victory = room
      ? this.victoryService.determineWinner({
          room,
          trigger: VictoryTrigger.PLAYER_LEFT,
          actorId: client.data.user.userId,
        })
      : null;

    if (room && victory) {
      this.gameService.finishGame(room, victory);
    }

    if (!roomId) {
      return;
    }

    this.logger.log(`[${SocketEvent.LEAVE_ROOM}] 유저 ${client.data.user.nickname}(${client.data.user.userId})가 방(${roomId}) 퇴장 시도`);
    client.to(roomId).emit(SocketEvent.ROOM_UPDATED, {
      message: `${client.data.user.nickname}님이 퇴장하셨습니다. ${isDeleted ? '방이 삭제되었습니다.' : ''}`,
    });

    if (room && victory) {
      this.server.to(roomId).emit(SocketEvent.GAME_OVER, {
        winnerId: room.winnerId,
        winReason: room.winReason,
        message: `${victory.winner.nickname}님이 마지막 플레이어로 남아 승리했습니다.`,
      });
    }

    client.leave(roomId);

    delete client.data.room; // 클라이언트의 소켓 데이터에서 방 정보 제거
  }

  // 준비 상태 변경
  @UseGuards(GameParticipantGuard)
  @SubscribeMessage(SocketEvent.GAME_READY)
  handleGameReady(
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.toggleReady(client.data.user.userId);
    const player = room.players.find(p => p.userId === client.data.user.userId);
    const status = player?.isReady ? '준비 완료' : '준비 취소';
    this.logger.log(`[${SocketEvent.GAME_READY}] 유저 ${client.data.user.nickname}(${client.data.user.userId})가 방(${room.roomId})에서 ${status} 상태로 변경됨`);

    this.server.to(room.roomId).emit(SocketEvent.ROOM_UPDATED, {
      room,
      message: `${client.data.user.nickname}님이 ${status} 상태로 변경하셨습니다.`,
    });
  }

  // 카드 내기 (playCard)
  @UseGuards(GameParticipantGuard, TurnOwnerGuard)
  @UseInterceptors(GameResponseInterceptor)
  @SubscribeMessage(SocketEvent.PLAY_CARD)
  async handlePlayCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PlayCardDto,
  ) {
    this.logger.log(
      `[${SocketEvent.PLAY_CARD}] 유저 ${client.data.user.nickname}(${client.data.user.userId})가 방(${data.roomId})에 카드(${data.cardId}) 제출 시도`
    );
    await this.gameActionQueue.enqueue({
      type: GameActionType.PLAY_CARD,
      roomId: data.roomId,
      userId: client.data.user.userId,
      expectedActionId: data.expectedActionId,
      cardId: data.cardId,
      chosenSuit: data.chosenSuit,
    });

    const updatedRoom = this.roomService.getRoom(data.roomId);

    if (!updatedRoom) {
      throw new WsException('Room not found');
    }

    this.server
      .to(updatedRoom.roomId)
      .emit(
        SocketEvent.GAME_STATE_UPDATE,
        {
          message: `${client.data.user.nickname}님이 [${updatedRoom.lastCard?.suit} ${updatedRoom.lastCard?.value}] 카드를 냈습니다.`,
        }
      );

    if (
      updatedRoom.status === 'FINISHED' &&
      updatedRoom.winnerId
    ) {
      this.server.to(updatedRoom.roomId).emit(
        SocketEvent.GAME_OVER,
        {
          winnerId: updatedRoom.winnerId,
          winReason: updatedRoom.winReason,
          message: `${client.data.user.nickname}님이 승리했습니다.`,
        },
      );
    }

    return updatedRoom;
  }

  @UseGuards(GameParticipantGuard, TurnOwnerGuard)
  @UseInterceptors(GameResponseInterceptor)
  @SubscribeMessage(SocketEvent.DRAW_CARD)
  async handleDrawCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ActionDto,
  ) {
    this.logger.log(
      `[${SocketEvent.DRAW_CARD}] 유저 ${client.data.user.nickname}(${client.data.user.userId})가 방(${data.roomId})에서 카드 드로우 시도`
    );

    await this.gameActionQueue.enqueue({
      type: GameActionType.DRAW_CARD,
      roomId: data.roomId,
      userId: client.data.user.userId,
      expectedActionId: data.expectedActionId,
    });

    const updatedRoom = this.roomService.getRoom(data.roomId);

    if (!updatedRoom) {
      throw new WsException('Room not found');
    }

    this.server
      .to(updatedRoom.roomId)
      .emit(
        SocketEvent.GAME_STATE_UPDATE,
        {
          message: `${client.data.user.nickname}님이 카드를 한 장 뽑았습니다.`,
        }
      );

    return updatedRoom;
  }

  // 초기화 확인
  afterInit(server: Server) {
    server.use(SocketAuthMiddleware(this.authService));
    this.logger.log('Platform: Socket.io 엔진 초기화 완료 🚀');
  }

  // 접속 확인
  handleConnection(client: Socket<any, any, any, SocketData>) {
    // 미들웨어에서 주입한 유저 데이터가 있는지 확인
    const user = client.data.user;

    if (!user) {
      this.logger.error('인증되지 않은 사용자가 접속을 시도했습니다.');
      client.disconnect();
      return;
    }

    this.logger.log(`User Connected: ${user.nickname} (${user.userId})`);
    this.logger.log(`접속 감지: ${client.id}`);
  }

  // 접속 해제 확인
  handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (!user) {
      this.logger.warn(`접속 해제된 소켓(${client.id})에 유저 세션이 없습니다.`);
      return;
    }

    const room = this.roomService.markDisconnected(user.userId);
    this.scheduleDisconnectTimeout(user.userId);

    this.logger.log(`User Disconnected: ${user.nickname} (${user.userId})`);
    this.logger.log(`접속 해제: ${client.id}`);

    if (room) {
      this.server.to(room.roomId).emit(SocketEvent.ROOM_UPDATED, {
        room,
        message: `${user.nickname}님이 연결 해제되었습니다. ${this.DISCONNECT_GRACE_MS / 1000}초 내에 복귀하지 않으면 방에서 퇴장 처리됩니다.`,
      });
    }

    delete client.data.room;
  }

  // 클라이언트 핸드쉐이크 완료 후 초기 유저 정보 전달
  @SubscribeMessage(SocketEvent.CLIENT_READY)
  handleClientReady(
    @ConnectedSocket() client: Socket,
  ) {
    // 미들웨어에서 주입한 유저 데이터 꺼내기
    const user = client.data.user;

    const identityData: SocketData['user'] = {
      userId: user.userId,
      nickname: user.nickname,
      isGuest: user.isGuest,
    }

    if (user.isGuest) {
      identityData.accessToken = user.accessToken; // 게스트도 토큰이 있을 수 있으므로 포함
    }

    client.emit(SocketEvent.IDENTITY, identityData); // 클라이언트에게 유저 정보 전달
  }

  @UseGuards(GameParticipantGuard, RoomMasterGuard)
  @UseInterceptors(GameResponseInterceptor)
  @SubscribeMessage(SocketEvent.GAME_START)
  handleGameStart(
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    this.logger.log(`[${SocketEvent.GAME_START}] 유저 ${client.data.user.nickname}(${client.data.user.userId})가 게임 시작 시도`);
    const updatedRoom = this.gameService.startGame(user.userId);

    this.server.to(updatedRoom.roomId).emit(SocketEvent.GAME_STARTED);
    return updatedRoom; // 인터셉터에서 마스킹 후 클라이언트에게 전달
  }

  @UseGuards(GameParticipantGuard, RoomMasterGuard)
  @UseInterceptors(GameResponseInterceptor)
  @SubscribeMessage(SocketEvent.RETURN_TO_WAITING)
  handleReturnToWaiting(
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    this.logger.log(
      `[${SocketEvent.RETURN_TO_WAITING}] 유저 ${user.nickname}(${user.userId})가 로비 복귀 시도`,
    );

    const updatedRoom =
      this.roomService.resetRoomToWaiting(user.userId);

    this.server.to(updatedRoom.roomId).emit(
      SocketEvent.ROOM_UPDATED,
      {
        message: '다음 게임 준비를 위해 로비 상태로 전환되었습니다.',
      },
    );

    return updatedRoom;
  }

  @UseGuards(GameParticipantGuard)
  @UseInterceptors(GameResponseInterceptor)
  @SubscribeMessage(SocketEvent.GET_GAME_STATE)
  handleGetGameState(
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;

    this.logger.log(
      `[${SocketEvent.GET_GAME_STATE}] 유저 ${user.nickname}(${user.userId})가 게임 상태 요청`,
    );

    return this.gameService.getGameState(user.userId);
  }

  private scheduleDisconnectTimeout(userId: string): void {
    this.clearDisconnectTimeout(userId);

    const timer = setTimeout(() => {
      this.handleDisconnectTimeout(userId);
    }, this.DISCONNECT_GRACE_MS);

    this.disconnectTimers.set(userId, timer);
  }

  private clearDisconnectTimeout(userId: string): void {
    const timer = this.disconnectTimers.get(userId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.disconnectTimers.delete(userId);
  }

  private handleDisconnectTimeout(userId: string): void {
    this.clearDisconnectTimeout(userId);

    const roomBeforeLeave = this.roomService.getUserRoom(userId);
    if (!roomBeforeLeave) {
      return;
    }

    const roomSnapshot = this.roomService.getRoom(roomBeforeLeave);
    const player =
      roomSnapshot?.players.find((candidate) => candidate.userId === userId);

    if (!roomSnapshot || !player || player.isConnected) {
      return;
    }

    const { room, roomId, isDeleted } = this.roomService.leaveRoom(userId);
    const victory = room
      ? this.victoryService.determineWinner({
          room,
          trigger: VictoryTrigger.PLAYER_LEFT,
          actorId: userId,
        })
      : null;

    if (room && victory) {
      this.gameService.finishGame(room, victory);
    }

    if (!roomId) {
      return;
    }

    this.server.to(roomId).emit(SocketEvent.ROOM_UPDATED, {
      room,
      message: `${player.nickname}님이 복귀하지 않아 방에서 퇴장 처리되었습니다.${isDeleted ? ' 방이 삭제되었습니다.' : ''}`,
    });

    if (room && victory) {
      this.server.to(roomId).emit(SocketEvent.GAME_OVER, {
        winnerId: room.winnerId,
        winReason: room.winReason,
        message: `${victory.winner.nickname}님이 마지막 플레이어로 남아 승리했습니다.`,
      });
    }
  }

  private buildJoinRoomMessage(
    nickname: string,
    status: GameRoom['status'],
    role?: 'PLAYER' | 'SPECTATOR',
  ): string {
    if (
      status === GameStatus.FINISHED &&
      role === 'SPECTATOR'
    ) {
      return `${nickname}님이 게임이 종료된 방에 관전자로 입장하셨습니다.`;
    }

    if (
      status === GameStatus.PLAYING &&
      role === 'SPECTATOR'
    ) {
      return `${nickname}님이 진행 중인 게임에 관전자로 입장하셨습니다.`;
    }

    return `${nickname}님이 입장하셨습니다.`;
  }
}
