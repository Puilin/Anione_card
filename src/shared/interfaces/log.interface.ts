import { CardSuit } from "../enums/game.enum";
import { LogType } from "../enums/log.enum";

export interface GameLog {
    id: string;         // 로그 식별용 (UUID 등)
    type: LogType;
    actorId: string;    // 누가 (플레이어 ID)
    actorName: string;  // 누가 (닉네임 - 매번 Join하기 번거로우므로 포함)
    targetId?: string;  // 누구에게 (공격 시)
    cardId?: string;    // 어떤 카드로
    payload?: {
        suit?: CardSuit,
        power?: number,
        attackStack?: number,
        message?: string; // 시스템 공지용 텍스트 필드
    };      // 추가 정보 저장
    timestamp: number;  // 발생 시각 (서버 기준)
}