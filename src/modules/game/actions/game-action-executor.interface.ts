import { GameAction } from 'src/shared/interfaces/game-action.interface';

export interface GameActionExecutor {
  execute(action: GameAction): Promise<void>;
}
