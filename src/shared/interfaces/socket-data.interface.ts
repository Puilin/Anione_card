import 'socket.io';
import { GameRoom } from './game.interface';
declare module 'socket.io' {
  export interface SocketData {
    user: {
      userId: string;
      nickname: string;
      isGuest: boolean;
      accessToken?: string;
    };
    room: GameRoom;
  }
}