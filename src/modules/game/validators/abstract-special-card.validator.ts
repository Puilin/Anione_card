import { WsException } from '@nestjs/websockets';

import { CardType } from 'src/shared/enums/game.enum';
import { Card } from 'src/shared/interfaces/game.interface';

import {
  CardActionValidator,
  ValidateCardActionParams,
} from './card-action.validator';

export interface SpecialCardRuleContext {
  room: ValidateCardActionParams['room'];
  card: ValidateCardActionParams['card'];
  lastCard: NonNullable<ValidateCardActionParams['room']['lastCard']>;
}

export abstract class AbstractSpecialCardValidator extends CardActionValidator {
  protected abstract readonly specialValue: string;

  supports(card: Card): boolean {
    return (
      card.type === CardType.SPECIAL &&
      card.value === this.specialValue
    );
  }

  protected validateRule(
    params: ValidateCardActionParams,
  ): void {
    const { room, card } = params;

    if (card.value !== this.specialValue) {
      throw new WsException(
        `This validator only supports ${this.specialValue} card`,
      );
    }

    const lastCard = room.lastCard;

    if (!lastCard) {
      throw new WsException(
        'Last card does not exist',
      );
    }

    const ctx: SpecialCardRuleContext = {
      room,
      card,
      lastCard,
    };

    const canPlay =
      room.attackStack > 0
        ? this.canPlayWhenAttackStack(ctx)
        : this.canPlayWhenNoAttackStack(ctx);

    if (!canPlay) {
      throw new WsException(
        this.getInvalidPlayMessage(),
      );
    }
  }

  protected abstract canPlayWhenAttackStack(
    ctx: SpecialCardRuleContext,
  ): boolean;

  protected abstract canPlayWhenNoAttackStack(
    ctx: SpecialCardRuleContext,
  ): boolean;

  protected abstract getInvalidPlayMessage(): string;
}
