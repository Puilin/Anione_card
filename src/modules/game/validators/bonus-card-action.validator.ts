import {
  AbstractSpecialCardValidator,
  SpecialCardRuleContext,
} from './abstract-special-card.validator';

export class BonusCardValidator extends AbstractSpecialCardValidator {
  protected readonly specialValue = 'BONUS';

  protected canPlayWhenAttackStack(): boolean {
    return false;
  }

  protected canPlayWhenNoAttackStack(
    ctx: SpecialCardRuleContext,
  ): boolean {
    return this.isSameSuit(ctx.lastCard, ctx.card);
  }

  protected getInvalidPlayMessage(): string {
    return 'Cannot play bonus card in current state';
  }
}
