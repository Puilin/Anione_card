import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { SocketEvent } from 'src/shared/enums/socket-event.enum';
import { GameErrorCode } from 'src/shared/enums/game-error-code.enum';

// WebSocket 전용 예외 필터
@Catch(WsException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger('WsException');

  catch(exception: any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const data = host.switchToWs().getData();
    const error = exception instanceof WsException ? exception.getError() : exception.response;
    const normalizedError = this.normalizeError(error);

    // 서버 터미널에 에러 로그 남기기
    this.logger.error(`Validation Failed for user ${client.data.user?.userId}`);
    this.logger.error(`Input Data: ${JSON.stringify(data)}`);
    this.logger.error(`Error Detail: ${JSON.stringify(normalizedError)}`);

    // 클라이언트에게 에러 메시지 전송
    client.emit('response', {
      status: SocketEvent.GAME_ERROR,
      message: normalizedError.message,
      code: normalizedError.code,
      details: normalizedError.details,
    });
  }

  private normalizeError(error: unknown): {
    message: string;
    code?: GameErrorCode;
    details: unknown;
  } {
    // TODO(ANI-29): WsException 에러코드 체계 도입 시
    // { code, message } 형태의 모든 도메인 에러를 공통 포맷으로 일반화한다.
    if (
      this.isErrorPayload(error)
      && error.code === GameErrorCode.GAME_STATE_OUTDATED
    ) {
      return {
        message: error.message,
        code: error.code,
        details: error,
      };
    }

    return {
      message: '잘못된 형식의 요청입니다.',
      details: error || 'Validation Error',
    };
  }

  private isErrorPayload(
    error: unknown,
  ): error is { code?: GameErrorCode; message: string } {
    return typeof error === 'object'
      && error !== null
      && 'message' in error;
  }
}
