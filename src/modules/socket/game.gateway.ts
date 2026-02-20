import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameReadyDto, JoinRoomDto, LeaveRoomDto, PlayCardDto } from './dto/game-room.dto';
import { SocketEvent } from 'src/shared/enums/socket-event.enum';

@WebSocketGateway({
  namespace: 'game', // 게임 채널 분리
  cors: { origin: '*' }, // 개발 편의를 위한 CORS 허용
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('GameGateway');

  // 방 입장 (joinRoom)
  @SubscribeMessage(SocketEvent.JOIN_ROOM)
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
  ) {
    this.logger.log(`[${SocketEvent.JOIN_ROOM}] 유저(${client.id})가 방(${data.roomId}) 입장 시도`);
    // TODO: RoomService.joinRoom 호출
  }

  // 방 퇴장 (leaveRoom)
  @SubscribeMessage(SocketEvent.LEAVE_ROOM)
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaveRoomDto,
  ) {
    this.logger.log(`[${SocketEvent.LEAVE_ROOM}] 유저(${client.id})가 방(${data.roomId}) 퇴장 시도`);
    // TODO: RoomService.leaveRoom 호출
  }

  // 준비 상태 변경
  @SubscribeMessage(SocketEvent.GAME_READY)
  handleGameReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GameReadyDto,
  ) {
    const status = data.isReady ? '준비 완료' : '준비 취소';
    this.logger.log(`[${SocketEvent.GAME_READY}] 유저(${client.id})가 방(${data.roomId})에서 ${status} 상태로 변경`);
    // TODO: RoomService.updateReadyStatus 호출
  }

  // 카드 내기 (playCard)
  @SubscribeMessage(SocketEvent.PLAY_CARD)
  handlePlayCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PlayCardDto,
  ) {
    this.logger.log(
      `[${SocketEvent.PLAY_CARD}] 유저(${client.id})가 방(${data.roomId})에 카드(${data.cardId}) 제출 시도`
    );
    // TODO: GameService.playCard 호출
  }

  // 초기화 확인
  afterInit(server: Server) {
    this.logger.log('Platform: Socket.io 엔진 초기화 완료 🚀');
  }

  // 접속 확인
  handleConnection(client: Socket) {
    this.logger.log(`접속 감지: ${client.id}`);
  }

  // 접속 해제 확인
  handleDisconnect(client: Socket) {
    this.logger.log(`접속 해제: ${client.id}`);
  }
}