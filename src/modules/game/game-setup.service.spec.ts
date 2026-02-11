import { GameSetupService } from './game-setup.service';
import { CardSuit, CardType } from '../../shared/enums/game.enum';
import { Card, Player } from 'src/shared/interfaces/game.interface';

describe('GameSetupService', () => {
  let service: GameSetupService;

  beforeEach(() => {
    service = new GameSetupService();
  });

  describe('createDeck', () => {
    let deck: Card[];
    const suits = Object.values(CardSuit);

    beforeEach(() => {
      deck = service.createDeck();
    })

    test('총 76장의 카드가 생성되어야 한다 (1~10까지 * 4장 + 특수카드 5종 * 4장 + 공격(1,2,3단계)*4장 + 와일드카드 4장)', () => {
      expect(deck.length).toBe(76);
    });

    test('생성된 모든 카드는 서로 다른 고유 ID를 가져야 한다', () => {
      const ids = new Set(deck.map(c => c.id));
      expect(ids.size).toBe(76); // 중복이 없어야 함
    });

    test.each(suits)(
      '%s 동물의 특수 카드는 5장이 존재해야 한다',
      (suit) => {
        const specials = deck.filter(c => c.suit === suit && c.type === CardType.SPECIAL);
        expect(specials.length).toBe(5);
      }
    );

    test.each(suits)(
      '%s 동물의 공격 카드는 3장이 존재해야 한다',
      (suit) => {
        const attack = deck.filter(c => c.suit === suit && c.type === CardType.ATTACK);
        expect(attack.length).toBe(3);
      }
    );

    test.each(suits)(
      '%s 동물의 와일드 카드는 1장이 존재해야 한다',
      (suit) => {
        const wild = deck.filter(c => c.suit === suit && c.type === CardType.WILD);
        expect(wild.length).toBe(1);
      }
    );

    test.each(suits)(
      '각 동물의 숫자카드는 1부터 10까지 누락없이 생성되어야 한다',
      (suit) => {
        const actualNumbers = deck
          .filter(c => c.suit === suit && c.type === CardType.NUMBER)
          .map(c => parseInt(c.value))
          .sort((a, b) => a - b);

        const expectedNumbers = Array.from({ length: 10 }, (_, i) => i + 1)

        expect(actualNumbers).toEqual(expectedNumbers);
      }
    );
  });

  describe('shuffle', () => {
    it('셔플 후에도 카드의 총 개수와 구성 요소는 변함이 없어야 한다', () => {
      const originalDeck = service.createDeck();
      const shuffledDeck = [...originalDeck];
      service.shuffle(shuffledDeck);

      expect(shuffledDeck.length).toBe(originalDeck.length);

      // 원본의 ID 리스트와 셔플된 ID 리스트를 정렬해서 비교 (구성 요소 동일 확인)
      const originalIds = originalDeck.map(c => c.id).sort();
      const shuffledIds = shuffledDeck.map(c => c.id).sort();
      expect(shuffledIds).toEqual(originalIds);
    });

    it('셔플 후의 덱은 원본 덱과 순서가 달라야 한다', () => {
      const deck1 = service.createDeck();
      const deck2 = [...deck1];
      service.shuffle(deck2);

      // 전체 순서 비교
      expect(deck1).not.toEqual(deck2);
    });
  });

  describe('distributeCards', () => {
    const playerScenarios = [
      { count: 2, expectedRemaining: 76 - 14 },
      { count: 3, expectedRemaining: 76 - 21 },
      { count: 4, expectedRemaining: 76 - 28 },
    ];
    const cardsToBeDistributed = 7;

    const createMockPlayer = (id: number): Player => ({
      userId: `user_${id}`,
      nickname: `nickname_${id}`,
      cardCount: 0,
      hand: [],
      isReady: true,
      isOut: false,
      role: 'PLAYER',
    });

    test.each(playerScenarios)(
      `$count인 플레이어가 ${cardsToBeDistributed}장씩 분배받아야 한다. 남은 덱은 $expectedRemaining장이어야 한다`,
      ({ count, expectedRemaining }) => {
        // 플레이어 수만큼 가짜 배열 생성
        const players: Player[] = Array.from({ length: count }, (_, i) => createMockPlayer(i));
        const deck = service.createDeck();

        // 실행
        const { updatedPlayers, remainingDeck } = service.distributeCards(deck, players, cardsToBeDistributed);

        // 검증
        expect(updatedPlayers.length).toBe(count); // 분배가 모든 인원에게 잘 되었는지 체크
        updatedPlayers.forEach(p => expect(p.hand.length).toBe(cardsToBeDistributed)); // 분배 된 카드 갯수 체크
        expect(remainingDeck.length).toBe(expectedRemaining); // 남은 카드의 갯수 체크
      }
    );
  });
});