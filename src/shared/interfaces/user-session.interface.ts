export interface UserSession {
  /** 유저 고유 식별자 (UUID) */
  readonly userId: string;
  
  /** 표시될 이름 (Guest_XXXX 또는 실제 닉네임) */
  readonly nickname: string;
  
  /** 로그인 여부 (Guest와 회원을 구분하여 DB 저장 로직 분기) */
  readonly isGuest: boolean;
  
  /** 접속 IP (보안 및 다중접속 방지용) */
  readonly ip?: string;
  
  /** 접속 시각 (세션 유지 시간 체크용) */
  readonly connectedAt: number;

  /** 토큰 자체는 세션 정보에 포함하지만, 
   * 클라이언트에 다시 보낼 때만 사용하고 서버 로직에선 userId만 참조합니다.
   */
  readonly accessToken?: string;
}