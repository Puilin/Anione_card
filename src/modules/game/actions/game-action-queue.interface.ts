import { GameAction } from 'src/shared/interfaces/game-action.interface';

export interface GameActionQueue {
  enqueue(action: GameAction): Promise<void>;
}
