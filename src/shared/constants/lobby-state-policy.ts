import { GameStatus } from '../enums/game.enum';

export const LOBBY_STATE_ACTION_POLICY = {
  [GameStatus.WAITING]: {
    joinAs: 'PLAYER',
    canToggleReady: true,
    canStartGame: true,
    canChangeRole: true,
    canReturnToWaiting: false,
  },
  [GameStatus.PLAYING]: {
    joinAs: 'SPECTATOR',
    canToggleReady: false,
    canStartGame: false,
    canChangeRole: false,
    canReturnToWaiting: false,
  },
  [GameStatus.FINISHED]: {
    joinAs: 'SPECTATOR',
    canToggleReady: false,
    canStartGame: false,
    canChangeRole: false,
    canReturnToWaiting: true,
  },
} as const;

export type LobbyStateActionPolicy =
  typeof LOBBY_STATE_ACTION_POLICY;
