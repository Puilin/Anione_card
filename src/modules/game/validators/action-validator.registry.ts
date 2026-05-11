import { Inject, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

import { Card } from 'src/shared/interfaces/game.interface';

import { ActionValidator } from './action-validator.interface';
import { ACTION_VALIDATORS } from './action-validator.token';

@Injectable()
export class ActionValidatorRegistry {
  constructor(
    @Inject(ACTION_VALIDATORS)
    private readonly validators: ActionValidator[],
  ) {}

  getValidator(card: Card): ActionValidator {
    const matchedValidators = this.validators.filter(
      (candidate) => candidate.supports(card),
    );

    if (matchedValidators.length === 0) {
      throw new WsException(
        `No validator found for card: ${card.value}`,
      );
    }

    if (matchedValidators.length > 1) {
      throw new WsException(
        `Multiple validators found for card: ${card.value}`,
      );
    }

    return matchedValidators[0];
  }
}
