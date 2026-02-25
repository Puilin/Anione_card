import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JoinRoomDto } from './game-room.dto';

describe('JoinRoomDto', () => {
  it('roomId가 UUID 형식이 아니면 유효성 검사에 실패해야 한다', async () => {
    const invalidTargets = [
      { roomId: 'room-1' },          // 단순 문자열
      { roomId: '12345' },           // 숫자
      { roomId: 'abc-def-ghi' },     // 잘못된 하이픈 위치
    ];

    for (const target of invalidTargets) {
      const dto = plainToInstance(JoinRoomDto, target);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      // 에러 메시지에 UUID 관련 내용이 포함되어 있는지도 확인
      expect(errors[0].constraints).toHaveProperty('isUuid');
    }
  });

  it('roomId가 누락되면 유효성 검사에 실패해야 한다', async () => {
      const target = {};
      const dto = plainToInstance(JoinRoomDto, target);
      const errors = await validate(dto);
  
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('roomId');
    });

  it('올바른 UUID 형식의 roomId가 전달되면 통과해야 한다', async () => {
    const target = { roomId: '550e8400-e29b-41d4-a716-446655440000' }; // 표준 UUID v4 예시
    const dto = plainToInstance(JoinRoomDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });
});