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
import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket, SocketData } from 'socket.io';
import { JoinRoomDto, LeaveRoomDto, PlayCardDto } from './dto/game-room.dto';
import { SocketEvent } from 'src/shared/enums/socket-event.enum';
import { SocketAuthMiddleware } from './middlewares/auth.middleware';
import { WsExceptionFilter } from 'src/common/filters/ws-exception.filter';
import { AuthService } from '../auth/auth.service';
import { RoomService } from './room.service';
import { GameService } from '../game/game.service';

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
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('GameGateway');

  constructor(
    private readonly authService: AuthService,
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
  ) {}

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

    // Socket.io의 'Room' 개념에 클라이언트를 넣어줍니다.
    client.join(room.roomId);

    // 방에 있는 모든 사람(나 포함)에게 새로운 유저가 왔음을 알립니다.
    this.server.to(room.roomId).emit(SocketEvent.ROOM_UPDATED, {
      room,
      message: `${client.data.user.nickname}님이 입장하셨습니다.`,
    });
  }

  // 방 퇴장 (leaveRoom)
  @SubscribeMessage(SocketEvent.LEAVE_ROOM)
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaveRoomDto,
  ) {
    const { room, roomId, isDeleted } = this.roomService.leaveRoom(client.data.user.userId);

    if (!roomId) {
      return;
    }

    this.logger.log(`[${SocketEvent.LEAVE_ROOM}] 유저 ${client.data.user.nickname}(${client.data.user.userId})가 방(${data.roomId}) 퇴장 시도`);
    client.to(roomId).emit(SocketEvent.ROOM_UPDATED, {
      room: isDeleted ? null : room, // 방이 삭제된 경우 null로 보냄
      message: `${client.data.user.nickname}님이 퇴장하셨습니다. ${isDeleted ? '방이 삭제되었습니다.' : ''}`,
    });

    client.leave(roomId);
  }

  // 준비 상태 변경
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
  @SubscribeMessage(SocketEvent.PLAY_CARD)
  handlePlayCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PlayCardDto,
  ) {
    this.logger.log(
      `[${SocketEvent.PLAY_CARD}] 유저 ${client.data.user.nickname}(${client.data.user.userId})가 방(${data.roomId})에 카드(${data.cardId}) 제출 시도`
    );
    // TODO: GameService.playCard 호출
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
    this.logger.log(`User Disconnected: ${user.nickname} (${user.userId})`);
    this.logger.log(`접속 해제: ${client.id}`);
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

  @SubscribeMessage(SocketEvent.GAME_START)
  handleGameStart(
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    this.logger.log(`[${SocketEvent.GAME_START}] 유저 ${client.data.user.nickname}(${client.data.user.userId})가 게임 시작 시도`);
    const updatedRoom = this.gameService.startGame(user.userId);

    this.server.to(updatedRoom.roomId).emit(SocketEvent.GAME_STARTED, updatedRoom);
  }
}