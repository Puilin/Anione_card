import { WsException } from '@nestjs/websockets';

import {
  CardType,
} from 'src/shared/enums/game.enum';
import { Card } from 'src/shared/interfaces/game.interface';

import {
  ValidateCardActionParams,
  CardActionValidator,
} from './card-action.validator';

export class NormalCardValidator extends CardActionValidator {

  supports(card: Card): boolean {
    return card.type === CardType.NUMBER;
  }

  protected validateRule(
    params: ValidateCardActionParams,
  ): void {
    const { room, card } = params;

    const lastCard = room.lastCard;

    // 마지막 카드가 존재해야 함
    if (!lastCard) {
      throw new WsException(
        'Last card does not exist',
      );
    }

    // 공격 스택이 존재하면 일반 숫자 카드 사용 불가
    if (room.attackStack > 0) {
      throw new WsException(
        'Cannot play normal card during attack stack',
      );
    }

    const isSameSuit =
      lastCard.suit === card.suit;

    const isSameValue =
      lastCard.value === card.value;

    // 문양 또는 숫자가 같아야 함
    if (!isSameSuit && !isSameValue) {
      throw new WsException(
        'Card does not match last card',
      );
    }
  }
}
