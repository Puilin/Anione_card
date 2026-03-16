import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { ConfigService } from "@nestjs/config";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // 값을 미리 변수에 할당하며 환경변수에서 JWT 설정을 가져옴
        const secret = config.get<string>('JWT_SECRET');
        const expiresIn = config.get<string>('JWT_EXPIRES_IN');

        // 만약 secret이 없으면 서버 실행 단계에서 에러를 던져 방어
        if (!secret) {
          throw new Error('JWT_SECRET is not defined in .env');
        }

        return {
          secret: secret, // 이제 undefined가 아님이 보장됩니다.
          signOptions: {
            // 'as any' 또는 명확한 캐스팅을 통해 타입 호환성을 맞춥니다.
            expiresIn: (expiresIn || '1h') as any, 
          },
        };
      },
    }),
  ],
  providers: [AuthService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}