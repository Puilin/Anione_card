import { GameRoom, Player } from 'src/shared/interfaces/game.interface';

export interface TurnEffect {
  // 이번 액션 직후 턴을 넘기지 않고 현재 플레이어가 즉시 한 번 더 행동해야 하는지 나타낸다.
  keepTurn: boolean;
  // keepTurn 이 false 일 때 몇 칸 전진할지 나타낸다.
  advanceSteps: number;
  // true 면 다음 턴 계산 전에 진행 방향을 반전한다.
  reverseDirection: boolean;
  // 턴 유지 여부와 별개로, 액션 적용 후 room.isBonusTurn 에 저장할 상태다.
  // 클라이언트 UI 와 후속 규칙 판정에서 "보너스 턴 상태가 남아있는가"를 표현한다.
  bonusTurn: boolean;
}

export interface ApplyTurnEffectParams {
  room: GameRoom;
  playerId: string;
  effect: TurnEffect;
}

export interface ResolveTurnAfterDrawParams {
  room: GameRoom;
  player: Player;
}

export interface ResolveTurnAfterLeaveParams {
  room: GameRoom;
  // leave 처리 직전 기준 현재 턴 주인이던 플레이어 ID
  currentTurnOwnerId: string;
  // 나가는 유저를 제외한 남은 플레이어 목록. 제거 전/후 호출 순서에 덜 민감한 계약을 위해 받는다.
  remainingPlayers: Player[];
}

/**
 * 턴 상태 전이만을 담당하는 도메인 계약.
 * 카드 효과 전체가 아니라 "누가 다음 턴을 가지는가"와
 * 그 계산에 필요한 방향/보너스 턴 메타데이터만 다룬다.
 */
export interface TurnManager {
  pickFirstTurnOwner(room: GameRoom): string;
  getNextActivePlayerId(
    room: GameRoom,
    currentUserId: string,
    stepCount?: number,
  ): string;
  applyTurnEffect(
    params: ApplyTurnEffectParams,
  ): string;
  resolveTurnAfterDraw(
    params: ResolveTurnAfterDrawParams,
  ): string;
  resolveTurnAfterLeave(
    params: ResolveTurnAfterLeaveParams,
  ): string | null;
}
