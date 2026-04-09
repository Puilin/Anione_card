import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { plainToInstance } from 'class-transformer';
import { GameRoomResponseDto } from '../dto/game-room.response.dto';
import { MaskingService } from '../masking.service';

@Injectable()
export class GameResponseInterceptor implements NestInterceptor {

  constructor(
    private readonly maskingService: MaskingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const client = context.switchToWs().getClient();
    const user = client.data.user;

    return next.handle().pipe(
      map((data) => {
        if (!data || !user) return data;

        // 유저 기준 마스킹
        const masked = this.maskingService.maskRoomForUser(
          data,
          user.userId,
        );

        return {
          success: true,
          data: plainToInstance(GameRoomResponseDto, masked, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true,
          }),
          timestamp: Date.now(),
        };
      }),
    );
  }
}