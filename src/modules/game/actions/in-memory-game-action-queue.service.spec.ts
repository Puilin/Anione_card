import { InMemoryGameActionQueue } from './in-memory-game-action-queue.service';
import { GameActionExecutor } from './game-action-executor.interface';
import { GameActionType } from 'src/shared/enums/game-action-type.enum';
import { GameAction } from 'src/shared/interfaces/game-action.interface';

describe('InMemoryGameActionQueue', () => {
  let queue: InMemoryGameActionQueue;
  let executor: jest.Mocked<GameActionExecutor>;

  beforeEach(() => {
    executor = {
      execute: jest.fn(),
    };

    queue = new InMemoryGameActionQueue(executor);
  });

  it('같은 room의 액션은 순차적으로 처리해야 한다', async () => {
    const started: string[] = [];
    const releaseByUserId = new Map<string, () => void>();

    executor.execute.mockImplementation((action) => {
      started.push(action.userId);

      return new Promise<void>((resolve) => {
        releaseByUserId.set(action.userId, resolve);
      });
    });

    const firstAction = createDrawAction('room-1', 'user-1');
    const secondAction = createDrawAction('room-1', 'user-2');

    const firstPromise = queue.enqueue(firstAction);
    const secondPromise = queue.enqueue(secondAction);

    await flushMicrotasks();

    expect(started).toEqual(['user-1']);
    expect(executor.execute).toHaveBeenCalledTimes(1);

    releaseByUserId.get('user-1')?.();
    await firstPromise;
    await flushMicrotasks();

    expect(started).toEqual(['user-1', 'user-2']);
    expect(executor.execute).toHaveBeenCalledTimes(2);

    releaseByUserId.get('user-2')?.();
    await secondPromise;
  });

  it('서로 다른 room의 액션은 병렬 처리 가능해야 한다', async () => {
    const started: string[] = [];
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;

    executor.execute.mockImplementation((action) => {
      started.push(action.roomId);

      return new Promise<void>((resolve) => {
        if (action.roomId === 'room-1') {
          resolveFirst = resolve;
          return;
        }

        resolveSecond = resolve;
      });
    });

    const firstPromise = queue.enqueue(createDrawAction('room-1', 'user-1'));
    const secondPromise = queue.enqueue(createDrawAction('room-2', 'user-2'));

    await flushMicrotasks();

    expect(started).toEqual(['room-1', 'room-2']);
    expect(executor.execute).toHaveBeenCalledTimes(2);

    resolveFirst();
    resolveSecond();

    await Promise.all([firstPromise, secondPromise]);
  });

  it('같은 room에 enqueue가 연속 호출돼도 processor는 하나만 실행되어야 한다', async () => {
    let activeExecutions = 0;
    let maxActiveExecutions = 0;
    const releases: Array<() => void> = [];

    executor.execute.mockImplementation(() => {
      activeExecutions += 1;
      maxActiveExecutions = Math.max(
        maxActiveExecutions,
        activeExecutions,
      );

      return new Promise<void>((resolve) => {
        releases.push(() => {
          activeExecutions -= 1;
          resolve();
        });
      });
    });

    const firstPromise = queue.enqueue(createDrawAction('room-1', 'user-1'));
    const secondPromise = queue.enqueue(createDrawAction('room-1', 'user-2'));
    const thirdPromise = queue.enqueue(createDrawAction('room-1', 'user-3'));

    await flushMicrotasks();
    expect(maxActiveExecutions).toBe(1);
    expect(executor.execute).toHaveBeenCalledTimes(1);

    releases.shift()?.();
    await firstPromise;
    await flushMicrotasks();
    expect(maxActiveExecutions).toBe(1);
    expect(executor.execute).toHaveBeenCalledTimes(2);

    releases.shift()?.();
    await secondPromise;
    await flushMicrotasks();
    expect(maxActiveExecutions).toBe(1);
    expect(executor.execute).toHaveBeenCalledTimes(3);

    releases.shift()?.();
    await thirdPromise;
    expect(maxActiveExecutions).toBe(1);
  });
});

function createDrawAction(roomId: string, userId: string): GameAction {
  return {
    type: GameActionType.DRAW_CARD,
    roomId,
    userId,
    expectedActionId: 0,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
