import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LeaveRoomDto } from './game-room.dto';

describe('LeaveRoomDto', () => {
  it('roomId가 UUID 형식이 아니면 isUuid 제약 조건 위반 에러가 발생해야 한다', async () => {
    const target = { roomId: 'invalid-id' };
    const dto = plainToInstance(LeaveRoomDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });

  it('roomId가 누락되면 유효성 검사에 실패해야 한다', async () => {
    const target = {};
    const dto = plainToInstance(LeaveRoomDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('roomId');
  });

  it('올바른 UUID 형식의 roomId가 전달되면 통과해야 한다', async () => {
    const target = { roomId: '550e8400-e29b-41d4-a716-446655440000' };
    const dto = plainToInstance(LeaveRoomDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });
});