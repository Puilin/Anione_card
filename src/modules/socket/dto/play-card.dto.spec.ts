import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PlayCardDto } from './game-room.dto';

describe('PlayCardDto', () => {
  it('roomId와 cardId가 모두 유효한 UUID v4 형식이면 통과해야 한다', async () => {
    const target = {
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      cardId: '770e8400-e29b-41d4-a716-446655441111',
      expectedActionId: 0,
    };
    const dto = plainToInstance(PlayCardDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('cardId가 UUID 형식이 아니면 유효성 검사에 실패해야 한다', async () => {
    const target = {
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      cardId: 'invalid-card-id',
      expectedActionId: 0,
    };
    const dto = plainToInstance(PlayCardDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });

  it('cardId가 누락되면 유효성 검사에 실패해야 한다', async () => {
    const target = {
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      expectedActionId: 0,
    };
    const dto = plainToInstance(PlayCardDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('cardId');
  });

  it('chosenSuit가 유효한 CardSuit면 통과해야 한다', async () => {
    const target = {
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      cardId: '770e8400-e29b-41d4-a716-446655441111',
      expectedActionId: 0,
      chosenSuit: 'CAT',
    };
    const dto = plainToInstance(PlayCardDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('chosenSuit가 유효하지 않으면 실패해야 한다', async () => {
    const target = {
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      cardId: '770e8400-e29b-41d4-a716-446655441111',
      expectedActionId: 0,
      chosenSuit: 'INVALID',
    };
    const dto = plainToInstance(PlayCardDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('chosenSuit');
  });

  it('expectedActionId가 누락되면 유효성 검사에 실패해야 한다', async () => {
    const target = {
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      cardId: '770e8400-e29b-41d4-a716-446655441111',
    };
    const dto = plainToInstance(PlayCardDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'expectedActionId')).toBe(true);
  });

  it('expectedActionId가 음수면 유효성 검사에 실패해야 한다', async () => {
    const target = {
      roomId: '550e8400-e29b-41d4-a716-446655440000',
      cardId: '770e8400-e29b-41d4-a716-446655441111',
      expectedActionId: -1,
    };
    const dto = plainToInstance(PlayCardDto, target);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'expectedActionId')).toBe(true);
  });
});
