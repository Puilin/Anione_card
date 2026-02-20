import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GameReadyDto } from './game-room.dto';

describe('GameReadyDto', () => {
  it('roomId가 UUID 형식이 아니면 유효성 검사에 실패해야 한다', async () => {
    const invalidTargets = [
      {
        roomId: 'room-1', // 단순 문자열
        isReady: true
      },
      {
        roomId: '12345', // 숫자
        isReady: true
      },
      {
        roomId: 'abc-def-ghi', // 잘못된 하이픈 위치
        isReady: true
      },
    ];

    for (const target of invalidTargets) {
      const dto = plainToInstance(GameReadyDto, target);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      // 에러 메시지에 UUID 관련 내용이 포함되어 있는지도 확인
      expect(errors[0].constraints).toHaveProperty('isUuid');
    }
  });

  it('roomId가 누락되면 유효성 검사에 실패해야 한다', async () => {
    const target = { isReady: true };
    const dto = plainToInstance(GameReadyDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('roomId');
  });

  it('isReady가 불리언 타입이 아니면 유효성 검사에 실패해야 한다', async () => {
    const target = {
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      isReady: 'true' // 문자열 전달
    };
    const dto = plainToInstance(GameReadyDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isBoolean');
  });

  it('isReady 필드가 없으면 유효성 검사에 실패해야 한다', async () => {
    const target = { roomId: '550e8400-e29b-41d4-a716-446655440000' };
    const dto = plainToInstance(GameReadyDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('isReady');
  });

  it('올바른 형식의 roomId와 isReady가 전달되면 통과해야 한다', async () => {
    const target = {
      roomId: '550e8400-e29b-41d4-a716-446655440000', // 부모의 요구사항 충족
      isReady: true                                  // 자신의 요구사항 충족
    };
    const dto = plainToInstance(GameReadyDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });
});