import { Card } from 'src/shared/interfaces/game.interface';

import { ValidateCardActionParams } from './card-action.validator';

export interface ActionValidator {
  supports(card: Card): boolean;
  validate(params: ValidateCardActionParams): void;
}
