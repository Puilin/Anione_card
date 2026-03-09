// src/modules/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * 유저의 UID를 담은 토큰을 생성합니다.
   */
  async generateToken(userId: string) {
    const payload = { sub: userId }; // 'sub'는 JWT 표준에서 주체(subject)를 의미합니다.
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  /**
   * 토큰을 검증하고 페이로드를 반환합니다.
   */
  async verifyToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (error) {
      // 만료되었거나 조작된 토큰일 경우 에러 발생
      throw new Error('Invalid token');
    }
  }
}