import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { SocketEvent } from 'src/shared/enums/socket-event.enum';

// WebSocket 전용 예외 필터
@Catch(WsException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger('WsException');

  catch(exception: any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const data = host.switchToWs().getData();
    const error = exception instanceof WsException ? exception.getError() : exception.response;

    // 서버 터미널에 에러 로그 남기기
    this.logger.error(`Validation Failed for user ${client.data.user?.userId}`);
    this.logger.error(`Input Data: ${JSON.stringify(data)}`);
    this.logger.error(`Error Detail: ${JSON.stringify(error)}`);

    // 클라이언트에게 에러 메시지 전송
    client.emit('response', {
      status: SocketEvent.GAME_ERROR,
      message: '잘못된 형식의 요청입니다.',
      details: error || 'Validation Error',
    });
  }
}