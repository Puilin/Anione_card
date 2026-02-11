import { CardSuit, CardType, GameDirection } from '../enums/game.enum';
import { GameLog } from './log.interface';

export interface Card {
  id: string;
  suit: CardSuit;
  type: CardType;
  value: string;      // "1"~"10", "SWORD_1~3", "SHIELD", "EVADE", "BONUS"
  power: number;      // 공격 시 칼 자루 수 (1~3), 그 외 0
  assetKey: string;
}

export interface Player {
  userId: string;
  nickname: string;
  hand: Card[]; // 개인에게 보여지는 카드덱 (서버에서 마스킹)
  cardCount: number; // 현재 들고 있는 카드의 개수 (공유가능)
  isReady: boolean;
  isOut: boolean;
  role: 'PLAYER' | 'SPECTATOR';
}

export interface GameRoom {
  roomId: string;
  attackStack: number;  // 누적된 벌칙 카드 수
  currentPower: number; // 마지막 칼 자루 수 (연쇄 공격을 얹기 위한 판정 기준)
  lastCard: Card | null; // 바닥에 놓인 카드
  lastActionId: number; // 액션 검증용 counter (멱등성 보장)
  turnOwner: string;    // 현재 턴 유저 ID
  isBonusTurn: boolean; // "+" 카드 활성화 여부
  direction: GameDirection; // 게임 진행 방향 (시계/반시계)
  players: Player[];
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  recentLogs: GameLog[]; // 최근 5개의 로그
}