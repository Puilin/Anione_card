import { GameRoom } from 'src/shared/interfaces/game.interface';
import { RoomService } from './room.service';
import { GameDirection, GameStatus } from 'src/shared/enums/game.enum';
import { WsException } from '@nestjs/websockets';
import { v4 as uuidv4 } from 'uuid';
import { TurnManagerService } from 'src/modules/game/turn-manager.service';

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(() => {
    service = new RoomService(
      new TurnManagerService(),
    );
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

    it('게임 종료 후 방에 입장하면 관전자가 되어야 한다', () => {
      room.status = 'FINISHED';

      const guest = mockUser();
      const updatedRoom = service.joinRoom(room.roomId, guest);

      const joinedPlayer = updatedRoom.players.find(p => p.userId === guest.userId);

      expect(joinedPlayer?.role).toBe('SPECTATOR');
      expect(joinedPlayer?.isReady).toBe(false);
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

      service.leaveRoom(host.userId);

      const updatedRoom = service.getRoom(room.roomId);
      expect(updatedRoom!.turnOwner).toBe(guest1.userId);
      expect(updatedRoom!.players.some(p => p.userId === updatedRoom!.turnOwner)).toBe(true); // 턴이 넘어간 유저가 실제 플레이어여야 한다
    });

    it('REVERSE로 방향이 바뀌고 BONUS 상태가 남아있는 상황에서 현재 턴 유저가 나가면, 반대 방향 기준으로 턴이 넘어가고 기존 턴 메타 상태는 유지되어야 한다', () => {
      const guest1 = mockUser();
      const guest2 = mockUser();
      const guest3 = mockUser();

      service.joinRoom(room.roomId, guest1);
      service.joinRoom(room.roomId, guest2);
      service.joinRoom(room.roomId, guest3);

      room.status = 'PLAYING';
      room.turnOwner = guest2.userId;
      room.direction = GameDirection.COUNTER_CLOCKWISE;
      room.isBonusTurn = true;

      service.leaveRoom(guest2.userId);

      const updatedRoom = service.getRoom(room.roomId);
      expect(updatedRoom!.turnOwner).toBe(guest1.userId);
      expect(updatedRoom!.direction).toBe(
        GameDirection.COUNTER_CLOCKWISE,
      );
      expect(updatedRoom!.isBonusTurn).toBe(true);
    });

    it('방에 아무도 없으면 방이 삭제되어야 한다', () => {
      const result = service.leaveRoom(host.userId);

      expect(result.isDeleted).toBe(true);
      expect(service.getRoom(room.roomId)).toBeUndefined();
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

    it('게임 종료 상태에서도 준비 상태를 변경할 수 없어야 한다', () => {
      const guest = mockUser();
      service.joinRoom(room.roomId, guest);

      room.status = 'FINISHED';

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

  describe('resetRoomToWaiting', () => {
    it('FINISHED 상태의 방을 WAITING으로 초기화해야 한다', () => {
      const host = mockUser();
      const guest = mockUser();
      const spectator = mockUser();
      const room = service.createRoom(host);

      service.joinRoom(room.roomId, guest);
      room.status = GameStatus.FINISHED;
      room.attackStack = 5;
      room.currentPower = 3;
      room.lastActionId = 9;
      room.turnOwner = guest.userId;
      room.isBonusTurn = true;
      room.direction = GameDirection.COUNTER_CLOCKWISE;
      room.winnerId = guest.userId;
      room.winReason = 'EMPTY_HAND' as any;
      room.lastCard = {
        id: uuidv4(),
        suit: 'DOG' as any,
        declaredSuit: 'DOG' as any,
        type: 'NUMBER' as any,
        value: '1',
        power: 0,
        assetKey: 'dog_1',
      };
      room.drawPile = [room.lastCard];
      room.discardPile = [room.lastCard];
      room.players.find((player) => player.userId === guest.userId)!.isReady = true;
      room.players.find((player) => player.userId === guest.userId)!.isOut = true;
      service.joinRoom(room.roomId, spectator);

      const updatedRoom = service.resetRoomToWaiting(host.userId);

      expect(updatedRoom.status).toBe(GameStatus.WAITING);
      expect(updatedRoom.attackStack).toBe(0);
      expect(updatedRoom.currentPower).toBe(0);
      expect(updatedRoom.lastCard).toBeNull();
      expect(updatedRoom.drawPile).toEqual([]);
      expect(updatedRoom.discardPile).toEqual([]);
      expect(updatedRoom.lastActionId).toBe(0);
      expect(updatedRoom.turnOwner).toBeNull();
      expect(updatedRoom.isBonusTurn).toBe(false);
      expect(updatedRoom.direction).toBe(GameDirection.CLOCKWISE);
      expect(updatedRoom.winnerId).toBeNull();
      expect(updatedRoom.winReason).toBeNull();

      const hostPlayer = updatedRoom.players.find((player) => player.userId === host.userId);
      const guestPlayer = updatedRoom.players.find((player) => player.userId === guest.userId);
      const spectatorPlayer = updatedRoom.players.find((player) => player.userId === spectator.userId);

      expect(hostPlayer).toMatchObject({ role: 'PLAYER', isReady: true, isOut: false, hand: [], cardCount: 0 });
      expect(guestPlayer).toMatchObject({ role: 'PLAYER', isReady: false, isOut: false, hand: [], cardCount: 0 });
      expect(spectatorPlayer).toMatchObject({ role: 'SPECTATOR', isReady: false, isOut: false, hand: [], cardCount: 0 });
      expect(updatedRoom.recentLogs.at(-1)?.payload).toMatchObject({
        message: '다음 게임 준비를 위해 로비 상태로 전환되었습니다.',
      });
    });

    it('FINISHED가 아니면 WAITING으로 되돌릴 수 없어야 한다', () => {
      const host = mockUser();
      const room = service.createRoom(host);

      expect(() => {
        service.resetRoomToWaiting(host.userId);
      }).toThrow(WsException);

      room.status = GameStatus.PLAYING;

      expect(() => {
        service.resetRoomToWaiting(host.userId);
      }).toThrow(WsException);
    });

    it('host가 아니면 WAITING으로 되돌릴 수 없어야 한다', () => {
      const host = mockUser();
      const guest = mockUser();
      const room = service.createRoom(host);

      service.joinRoom(room.roomId, guest);
      room.status = GameStatus.FINISHED;

      expect(() => {
        service.resetRoomToWaiting(guest.userId);
      }).toThrow(WsException);
    });
  });

  describe('changeRole', () => {
    it('WAITING 상태에서 spectator는 player로 변경할 수 있어야 한다', () => {
      const host = mockUser();
      const guest = mockUser();
      const room = service.createRoom(host);
      const joinedRoom = service.joinRoom(room.roomId, guest);
      const guestPlayer = joinedRoom.players.find((player) => player.userId === guest.userId)!;

      guestPlayer.role = 'SPECTATOR';

      const updatedRoom = service.changeRole(guest.userId, 'PLAYER');

      expect(updatedRoom.players.find((player) => player.userId === guest.userId)).toMatchObject({
        role: 'PLAYER',
        isReady: false,
      });
    });

    it('WAITING 상태에서 player는 spectator로 변경할 수 있어야 한다', () => {
      const host = mockUser();
      const guest = mockUser();
      const room = service.createRoom(host);
      service.joinRoom(room.roomId, guest);

      const updatedRoom = service.changeRole(guest.userId, 'SPECTATOR');

      expect(updatedRoom.players.find((player) => player.userId === guest.userId)).toMatchObject({
        role: 'SPECTATOR',
        isReady: false,
      });
    });

    it('host는 role을 변경할 수 없어야 한다', () => {
      const host = mockUser();
      service.createRoom(host);

      expect(() => {
        service.changeRole(host.userId, 'SPECTATOR');
      }).toThrow(WsException);
    });

    it('WAITING이 아니면 role을 변경할 수 없어야 한다', () => {
      const host = mockUser();
      const guest = mockUser();
      const room = service.createRoom(host);
      service.joinRoom(room.roomId, guest);
      room.status = GameStatus.FINISHED;

      expect(() => {
        service.changeRole(guest.userId, 'SPECTATOR');
      }).toThrow(WsException);
    });

    it('player 슬롯이 가득 차 있으면 spectator는 player로 변경할 수 없어야 한다', () => {
      const host = mockUser();
      const room = service.createRoom(host);
      const guest1 = mockUser();
      const guest2 = mockUser();
      const guest3 = mockUser();
      const spectator = mockUser();

      service.joinRoom(room.roomId, guest1);
      service.joinRoom(room.roomId, guest2);
      service.joinRoom(room.roomId, guest3);

      room.players.push({
        userId: spectator.userId,
        nickname: spectator.nickname,
        isGuest: spectator.isGuest,
        hand: [],
        cardCount: 0,
        isReady: false,
        isOut: false,
        role: 'SPECTATOR',
      });

      expect(() => {
        service.changeRole(spectator.userId, 'PLAYER');
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
