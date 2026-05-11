import { WsException } from '@nestjs/websockets';

import { CardType } from 'src/shared/enums/game.enum';
import { Card } from 'src/shared/interfaces/game.interface';

import {
  CardActionValidator,
  ValidateCardActionParams,
} from './card-action.validator';

export class AttackCardValidator extends CardActionValidator {

  supports(card: Card): boolean {
    return card.type === CardType.ATTACK;
  }

  protected validateRule(
    params: ValidateCardActionParams,
  ): void {
    const { room, card } = params;

    const lastCard = room.lastCard;

    if (!lastCard) {
      throw new WsException(
        'Last card does not exist',
      );
    }

    // 공격 체인 상태
    if (room.attackStack > 0) {
      // 현재 공격값 이상만 가능
      if (card.power < lastCard.power) {
        throw new WsException(
          'Attack card power is too low',
        );
      }

      return;
    }

    // 일반 상태에서는 같은 문양만 허용
    const isSameSuit =
      card.suit === lastCard.suit;

    if (!isSameSuit) {
      throw new WsException(
        'Attack card must match suit',
      );
    }
  }
}
