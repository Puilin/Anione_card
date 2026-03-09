import 'socket.io';
declare module 'socket.io' {
  export interface SocketData {
    user: {
      userId: string;
      nickname: string;
      isGuest: boolean;
      accessToken?: string;
    };
  }
}