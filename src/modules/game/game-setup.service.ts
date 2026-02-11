import { Injectable, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CardSuit, CardType } from '../../shared/enums/game.enum';
import { Card, Player } from '../../shared/interfaces/game.interface';

@Injectable()
export class GameSetupService {
  private readonly SUITS = Object.values(CardSuit);
  private readonly SPECIAL_TYPES = ['SHIELD', 'EVADE', 'PLUS_ONE', 'REVERSE', 'JUMP'];

  // 카드의 '원형'을 저장할 마스터 데이터 (Flyweight Factory 역할) => id만 제거하고 이후에 매핑
  private readonly masterDeck: Omit<Card, 'id'>[] = [];

  // 모듈이 초기화될 때 카드의 마스터 데이터를 생성
  constructor() {
    this.initializeMasterDeck();
  }

  /**
   * 서버 시작 시 딱 한 번만 실행되어 76장의 카드 원형을 생성합니다.
   */
  private initializeMasterDeck(): void {
    this.SUITS.forEach((suit) => {
      // 숫자 카드 (1~10)
      for (let i = 1; i <= 10; i++) {
        this.masterDeck.push(this.createCardPrototype(suit, CardType.NUMBER, i.toString(), 0));
      }
      // 공격 카드 (1~3)
      for (let i = 1; i <= 3; i++) {
        this.masterDeck.push(this.createCardPrototype(suit, CardType.ATTACK, `SWORD_${i}`, i));
      }
      // 특수 카드 (5종)
      this.SPECIAL_TYPES.forEach((type) => {
        this.masterDeck.push(this.createCardPrototype(suit, CardType.SPECIAL, type, 0));
      });
      // 와일드 카드 (1장)
      this.masterDeck.push(this.createCardPrototype(suit, CardType.WILD, 'WILD', 0));
    });
  }

  // omit 객체로 틀을 만들어주는 함수
  createCardPrototype(suit: CardSuit, type: CardType, value: string, power: number): Omit<Card, "id"> {
    return {
      suit,
      type,
      value,
      power,
      assetKey: `${suit}_${type}_${value}`.toUpperCase(),
    };
  }

  /**
   * Omit 객체에 id 매핑
   */
  createDeck(): Card[] {
    return this.masterDeck.map((prototype) => ({
      ...prototype,
      id: uuidv4(), // 외연적 상태(고유 식별자) 주입
    }));
  }

  /**
   * 셔플 (shuffle)
   * Fisher-Yates 알고리즘을 사용하여 원본 배열의 순서를 섞습니다.
   */
  shuffle(deck: Card[]): void {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  /**
   * 카드 분배 (distributeCards)
   * 플레이어들에게 지정된 수만큼 카드를 나눠주고 남은 덱을 반환합니다.
   */
  distributeCards(deck: Card[], players: Player[], count: number) {
    const totalRequired = players.length * count;
    if (deck.length < totalRequired) {
      throw new Error('부족한 카드 개수: 분배할 수 없습니다.');
    }

    // 원본 덱 보호를 위한 복사 (고전파 테스트의 불변성 검증 통과용)
    const remainingDeck = [...deck];
    
    const updatedPlayers = players.map((player) => {
      // 덱의 앞에서부터 순차적으로 추출
      const hand = remainingDeck.splice(0, count);
      
      return {
        ...player,
        hand: [...player.hand, ...hand],
        cardCount: player.hand.length + hand.length,
      };
    });

    return {
      updatedPlayers: updatedPlayers,
      remainingDeck,
    };
  }
}