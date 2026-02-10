export enum CardSuit {
  DOG = 'DOG',
  CAT = 'CAT',
  RABBIT = 'RABBIT',
  BEAR = 'BEAR',
  WILD = 'WILD', // 동물 변경용
}

export enum CardType {
  NUMBER = 'NUMBER',   // 일반 숫자 카드
  ATTACK = 'ATTACK',   // 칼 자루 공격 카드
  SPECIAL = 'SPECIAL', // 방패, 화살표, 한 장 더 내기, 점프, 역방향
}

export enum GameDirection {
    CLOCKWISE = 1, // 시계 방향
    COUNTER_CLOCKWISE = -1, // 반시계 방향
}