import { GameRoom } from 'src/shared/interfaces/game.interface';
import { RoomService } from './room.service';
import { GameDirection } from 'src/shared/enums/game.enum';
import { WsException } from '@nestjs/websockets';
import { v4 as uuidv4 } from 'uuid';

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(() => {
    service = new RoomService();
  });

  it('여러 방은 서로 영향을 주지 않아야 한다', () => {
    const room1 = service.createRoom(mockUser());
    const room2 = service.createRoom(mockUser());

    service.joinRoom(room1.roomId, mockUser());

    expect(room2.players.length).toBe(1);
  });

  describe('createRoom', () => {
    it('방 생성 시 방장이 자동으로 포함되어야 한다', () => {
      // Given
      const user = mockUser();

      // When
      const room = service.createRoom(user);

      // Then
      expect(room.players.length).toBe(1);
      expect(room.players[0].userId).toBe(user.userId);
      expect(room.status).toBe('WAITING');
    });

    it('생성된 방은 기본 초기값을 가져야 한다', () => {
      const host = mockUser();
      const room = service.createRoom(host);
      const roomId = service.getUserRoom(room.hostId);

      expect(roomId).toBe(room.roomId); // 역방향 인덱스 검증
      expect(room).toMatchObject({
        hostId: host.userId,
        attackStack: 0,
        currentPower: 0,
        lastCard: null,
        lastActionId: 0,
        turnOwner: null,
        isBonusTurn: false,
        direction: GameDirection.CLOCKWISE,
        status: 'WAITING',
        recentLogs: [],
      });
      expect(room.players.length).toBe(1);
      expect(room.players[0]).toMatchObject({
        userId: host.userId,
        isReady: true,
        role: 'PLAYER',
        hand: [],
        cardCount: 0,
      });
    });
  });

  describe('joinRoom', () => {
    let host: ReturnType<typeof mockUser>;
    let room: GameRoom;

    beforeEach(() => {
      // 각 테스트마다 새로운 방을 생성하여 독립적으로 테스트할 수 있도록 설정
      host = mockUser();
      room = service.createRoom(host);
    });

    it('게임 시작 전 방 입장 시 유저의 초기 상태와 인덱스가 정확히 설정되어야 한다 (Deep Validation)', () => {
      const guest = mockUser();
      const updatedRoom = service.joinRoom(room.roomId, guest);

      // 플레이어 객체 내부 상태 검증
      const joinedPlayer = updatedRoom.players.find(p => p.userId === guest.userId);
      expect(joinedPlayer).toMatchObject({
        userId: guest.userId,
        nickname: guest.nickname,
        isGuest: true,
        hand: [],
        cardCount: 0,
        isReady: false,
        role: 'PLAYER',
      });

      // 역방향 인덱스 동기화 검증
      const indexedRoomId = service.getUserRoom(guest.userId);
      expect(indexedRoomId).toBe(room.roomId);

      // 방의 기존 상태 보존 검증
      expect(updatedRoom.attackStack).toBe(0); // 입장했다고 스택이 쌓이면 안 됨

      // 방의 플레이어 수 증가 검증
      expect(updatedRoom.players.length).toBe(2);
    });

    it('게임 시작 후 방에 입장하면 관전자가 되어야 한다', () => {
      room.status = 'PLAYING';

      const guest = mockUser();
      const updatedRoom = service.joinRoom(room.roomId, guest);

      const joinedPlayer = updatedRoom.players.find(p => p.userId === guest.userId);

      expect(joinedPlayer?.role).toBe('SPECTATOR');
    });

    it('같은 방에 중복 입장할 수 없다', () => {
      const guest = mockUser();
      service.joinRoom(room.roomId, guest);

      expect(() => {
        service.joinRoom(room.roomId, guest);
      }).toThrow(WsException);
    });

    it('정상적으로 방에 입장하면 플레이어가 추가되어야 한다', () => {
      const guest = mockUser();
      const updatedRoom = service.joinRoom(room.roomId, guest);

      expect(updatedRoom.players.length).toBe(2);
    });

    it('정원이 초과되면 입장할 수 없다', () => {
      // 4명 채우기
      for (let i = 0; i < 3; i++) {
        service.joinRoom(room.roomId, mockUser());
      }

      expect(() => {
        service.joinRoom(room.roomId, mockUser());
      }).toThrow(WsException);
    });

    it('이미 방에 있는 유저는 다시 추가되지 않아야 한다', () => {
      const otherRoom = service.createRoom(mockUser());

      expect(() => {
        service.joinRoom(otherRoom.roomId, host);
      }).toThrow(WsException);
    });

    it('존재하지 않는 방에 입장하면 에러가 발생해야 한다', () => {
      expect(() => {
        service.joinRoom('invalid-room', mockUser());
      }).toThrow(WsException);
    });
  });

  describe('leaveRoom', () => {
    let host: ReturnType<typeof mockUser>;
    let room: GameRoom;

    beforeEach(() => {
      host = mockUser();
      room = service.createRoom(host);
    });

    it('유저가 나가면 players에서 제거되어야 한다', () => {
      const guest = mockUser();
      service.joinRoom(room.roomId, guest);

      service.leaveRoom(guest.userId);

      const updatedRoom = service.getRoom(room.roomId);
      expect(updatedRoom!.players.some(p => p.userId === guest.userId)).toBe(false);
    });

    it('유저가 나가면 userToRoom 인덱스에서도 제거되어야 한다', () => {
      const guest = mockUser();
      service.joinRoom(room.roomId, guest);

      service.leaveRoom(guest.userId);

      expect(service.getUserRoom(guest.userId)).toBeUndefined();
    });

    it('방장이 나가면 다른 유저에게 방장이 넘어가야 한다', () => {
      const guest = mockUser();

      service.joinRoom(room.roomId, guest);

      service.leaveRoom(host.userId);

      const updatedRoom = service.getRoom(room.roomId);
      expect(updatedRoom!.hostId).toBe(guest.userId);
    });

    it('게임 중인 방에서 현재 턴인 유저가 나가면 다음 사람에게 턴이 넘어가야 한다', () => {
      const guest1 = mockUser();
      const guest2 = mockUser();

      service.joinRoom(room.roomId, guest1);
      service.joinRoom(room.roomId, guest2);

      room.status = 'PLAYING';
      room.turnOwner = host.userId;
      room.direction = GameDirection.CLOCKWISE;

      const expectedNext = service.getNextTurnOwner(room, room.turnOwner);

      service.leaveRoom(host.userId);

      const updatedRoom = service.getRoom(room.roomId);
      expect(updatedRoom!.turnOwner).toBe(expectedNext);
      expect(updatedRoom!.players.some(p => p.userId === updatedRoom!.turnOwner)).toBe(true); // 턴이 넘어간 유저가 실제 플레이어여야 한다
    });

    it('방에 아무도 없으면 방이 삭제되어야 한다', () => {
      const result = service.leaveRoom(host.userId);

      expect(result.isDeleted).toBe(true);
      expect(service.getRoom(room.roomId)).toBeUndefined();
    });
  });

  describe('getNextTurnOwner', () => {
    let room: GameRoom;

    beforeEach(() => {
      const host = mockUser();
      room = service.createRoom(host);

      const guest1 = mockUser();
      const guest2 = mockUser();

      service.joinRoom(room.roomId, guest1);
      service.joinRoom(room.roomId, guest2);
    });

    it('direction에 따라 올바른 다음 턴 유저를 반환해야 한다', () => {
      room.direction = GameDirection.COUNTER_CLOCKWISE;

      const current = room.players[0].userId;
      const players = room.players.map(p => p.userId);

      const next = service.getNextTurnOwner(room, current);

      const currentIndex = players.indexOf(current);
      const expectedIndex = (currentIndex + room.direction + players.length) % players.length;

      expect(next).toBe(players[expectedIndex]);
    });

    it('존재하지 않는 유저를 기준으로 하면 에러가 발생해야 한다', () => {
      expect(() => {
        service.getNextTurnOwner(room, 'invalid-user');
      }).toThrow();
    });

    it('플레이어가 1명뿐이면 자기 자신을 반환해야 한다', () => {
      const soloRoom = service.createRoom(mockUser());

      const current = soloRoom.players[0].userId;
      const next = service.getNextTurnOwner(soloRoom, current);

      expect(next).toBe(current);
    });
  });

  describe('toggleReady', () => {
    let host: ReturnType<typeof mockUser>;
    let room: GameRoom;

    beforeEach(() => {
      host = mockUser();
      room = service.createRoom(host);
    });

    it('플레이어의 준비 상태를 토글해야 한다', () => {
      const guest = mockUser();
      service.joinRoom(room.roomId, guest);

      const before = room.players.find(p => p.userId === guest.userId)?.isReady;

      const updatedRoom = service.toggleReady(guest.userId);

      const after = updatedRoom.players.find(p => p.userId === guest.userId)?.isReady;

      expect(after).toBe(!before);
    });

    it('다른 플레이어의 상태에는 영향을 주지 않아야 한다', () => {
      const guest1 = mockUser();
      const guest2 = mockUser();

      service.joinRoom(room.roomId, guest1);
      service.joinRoom(room.roomId, guest2);

      const beforeGuest2 = room.players.find(p => p.userId === guest2.userId)?.isReady;

      service.toggleReady(guest1.userId);

      const afterGuest2 = room.players.find(p => p.userId === guest2.userId)?.isReady;

      expect(afterGuest2).toBe(beforeGuest2);
    });

    it('방장은 준비 상태를 변경할 수 없어야 한다', () => {
      expect(() => {
        service.toggleReady(host.userId);
      }).toThrow(WsException);
    });

    it('관전자는 준비 상태를 변경할 수 없어야 한다', () => {
      room.status = 'PLAYING';

      const guest = mockUser();
      service.joinRoom(room.roomId, guest); // spectator

      expect(() => {
        service.toggleReady(guest.userId);
      }).toThrow(WsException);
    });

    it('게임 중에는 준비 상태를 변경할 수 없어야 한다', () => {
      const guest = mockUser();
      service.joinRoom(room.roomId, guest);

      room.status = 'PLAYING';

      expect(() => {
        service.toggleReady(guest.userId);
      }).toThrow(WsException);
    });

    it('존재하지 않는 유저는 에러가 발생해야 한다', () => {
      expect(() => {
        service.toggleReady('invalid-user');
      }).toThrow(WsException);
    });
  });
});

function mockUser() {
  const userId = uuidv4();
  return {
    userId,
    nickname: `Guest_${userId.slice(0, 5)}`,
    isGuest: true,
  };
}