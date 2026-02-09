import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'game', // 게임 채널 분리
  cors: { origin: '*' }, // 개발 편의를 위한 CORS 허용
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('GameGateway');

  // 1. 초기화 확인
  afterInit(server: Server) {
    this.logger.log('Platform: Socket.io 엔진 초기화 완료 🚀');
  }

  // 2. 접속 확인
  handleConnection(client: Socket) {
    this.logger.log(`접속 감지: ${client.id}`);
  }

  // 3. 접속 해제 확인
  handleDisconnect(client: Socket) {
    this.logger.log(`접속 해제: ${client.id}`);
  }
}