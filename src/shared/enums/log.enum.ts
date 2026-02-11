export enum LogType {
  // 플레이어 액션
  ATTACK = 'ATTACK',
  DEFENSE = 'DEFENSE',
  DRAW = 'DRAW',
  EVADE = 'EVADE',
  BONUS = 'BONUS',
  REVERSE = 'REVERSE',
  SKIP = 'SKIP',

  // 시스템 및 흐름 제어
  GAME_START = 'GAME_START',
  GAME_END = 'GAME_END',
  PLAYER_JOIN = 'PLAYER_JOIN',
  PLAYER_LEAVE = 'PLAYER_LEAVE',
  NOTICE = 'NOTICE',
}