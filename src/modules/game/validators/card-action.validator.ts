import { WsException } from '@nestjs/websockets';

import {
  Card,
  GameRoom,
  Player,
} from 'src/shared/interfaces/game.interface';
import { BaseActionValidator, ValidateActionParams } from './base-action.validator';

export interface ValidateCardActionParams extends ValidateActionParams {
  card: Card;
}

/**
 * 카드 액션 전용 validator
 */
export abstract class CardActionValidator extends BaseActionValidator {

  /**
   * 카드 액션 검증 진입점
   */
  validate(
    params: ValidateCardActionParams,
  ): void {
    const { player, room, card } = params;

    // 공통 액션 검증
    this.validateBase({player, room});

    // 카드 ownership 검증
    this.validateCardOwnership(
      player,
      card.id,
    );

    // 카드별 세부 규칙 검증
    this.validateRule(params);
  }

  /**
   * 카드별 세부 규칙 구현
   */
  protected abstract validateRule(
    params: ValidateCardActionParams,
  ): void;

  /**
   * 실제 플레이어 소유 카드인지 검증
   */
  protected validateCardOwnership(
    player: Player,
    cardId: string,
  ): void {
    const hasCard = player.hand.some(
      (card) => card.id === cardId,
    );

    if (!hasCard) {
      throw new WsException(
        'Player does not own this card',
      );
    }
  }
}