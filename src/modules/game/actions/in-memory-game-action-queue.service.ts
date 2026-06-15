import { Inject, Injectable, Logger } from '@nestjs/common';

import { GameActionQueue } from './game-action-queue.interface';
import { GAME_ACTION_EXECUTOR } from './game-action.token';
import { GameAction } from 'src/shared/interfaces/game-action.interface';
import type { GameActionExecutor } from './game-action-executor.interface';

interface QueuedGameAction {
  action: GameAction;
  resolve: () => void;
  reject: (error: unknown) => void;
}

@Injectable()
export class InMemoryGameActionQueue implements GameActionQueue {
  private readonly logger = new Logger(InMemoryGameActionQueue.name);
  private readonly roomQueues = new Map<string, QueuedGameAction[]>();
  private readonly activeProcessors = new Set<string>();

  constructor(
    @Inject(GAME_ACTION_EXECUTOR)
    private readonly executor: GameActionExecutor,
  ) {}

  enqueue(action: GameAction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const roomQueue = this.roomQueues.get(action.roomId) ?? [];
      roomQueue.push({ action, resolve, reject });
      this.roomQueues.set(action.roomId, roomQueue);

      if (!this.activeProcessors.has(action.roomId)) {
        this.activeProcessors.add(action.roomId);
        void this.processRoomQueue(action.roomId);
      }
    });
  }

  private async processRoomQueue(roomId: string): Promise<void> {
    try {
      while (true) {
        const roomQueue = this.roomQueues.get(roomId);
        const queuedAction = roomQueue?.shift();

        if (!queuedAction) {
          this.roomQueues.delete(roomId);
          return;
        }

        try {
          await this.executor.execute(queuedAction.action);
          queuedAction.resolve();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.stack ?? error.message
              : JSON.stringify(error);

          this.logger.error(
            `Failed to execute action ${queuedAction.action.type} for room ${roomId} by user ${queuedAction.action.userId}: ${message}`,
          );
          queuedAction.reject(error);
        }

        if ((roomQueue?.length ?? 0) === 0) {
          this.roomQueues.delete(roomId);
        }
      }
    } finally {
      this.activeProcessors.delete(roomId);

      if ((this.roomQueues.get(roomId)?.length ?? 0) > 0) {
        this.activeProcessors.add(roomId);
        void this.processRoomQueue(roomId);
      }
    }
  }
}
