import { WsException } from '@nestjs/websockets';

import {
  Card,
  GameRoom,
} from 'src/shared/interfaces/game.interface';
import { CardType } from 'src/shared/enums/game.enum';

import {
  CardActionValidator,
  ValidateCardActionParams,
} from './card-action.validator';

export class WildcardActionValidator extends CardActionValidator {
  supports(card: Card): boolean {
    return card.type === CardType.WILD;
  }

  protected validateRule(
    params: ValidateCardActionParams,
  ): void {
    const { room, card } = params;

    if (!room.lastCard) {
      throw new WsException(
        'Wildcard requires a floor card',
      );
    }

    if (room.attackStack > 0) {
      throw new WsException(
        'Cannot play wildcard when there is an active attack stack',
      );
    }

    if (!this.isSameSuit(card, room.lastCard) && !this.isSameValue(card, room.lastCard)) {
      throw new WsException(
        'Wildcard must match either the suit or value of the floor card',
      );
    }
  }
}
