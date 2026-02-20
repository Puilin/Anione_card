export enum SocketEvent {
  // Client -> Server (Action)
  JOIN_ROOM = 'joinRoom',
  LEAVE_ROOM = 'leaveRoom',
  GAME_READY = 'gameReady',
  PLAY_CARD = 'playCard',
  DRAW_CARD = 'drawCard',

  // Server -> Client (Update/Response)
  GAME_STATE_UPDATE = 'gameStateUpdate',
  PLAYER_EFFECT = 'playerEffect',
  GAME_ERROR = 'gameError',
  GAME_OVER = 'gameOver',
}