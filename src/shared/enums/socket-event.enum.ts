export enum SocketEvent {
  // Client -> Server (Action)
  CLIENT_READY = 'clientReady',
  CREATE_ROOM = 'createRoom',
  JOIN_ROOM = 'joinRoom',
  LEAVE_ROOM = 'leaveRoom',
  GAME_READY = 'gameReady',
  PLAY_CARD = 'playCard',
  DRAW_CARD = 'drawCard',

  // Server -> Client (Update/Response)
  IDENTITY = 'identity',
  GAME_STATE_UPDATE = 'gameStateUpdate',
  PLAYER_EFFECT = 'playerEffect',
  GAME_ERROR = 'gameError',
  GAME_OVER = 'gameOver',
  ROOM_CREATED = "roomCreated",
  ROOM_UPDATED = "roomUpdated",
}