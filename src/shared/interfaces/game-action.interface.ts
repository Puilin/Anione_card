import { CardSuit } from '../enums/game.enum';
import { GameActionType } from '../enums/game-action-type.enum';

interface BaseGameAction {
  type: GameActionType;
  roomId: string;
  userId: string;
  expectedActionId: number;
}

export interface PlayCardAction extends BaseGameAction {
  type: GameActionType.PLAY_CARD;
  cardId: string;
  chosenSuit?: CardSuit;
}

export interface DrawCardAction extends BaseGameAction {
  type: GameActionType.DRAW_CARD;
}

export type GameAction = PlayCardAction | DrawCardAction;
