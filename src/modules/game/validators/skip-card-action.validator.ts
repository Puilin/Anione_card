import {
  AbstractSpecialCardValidator,
  SpecialCardRuleContext,
} from './abstract-special-card.validator';

export class SkipCardValidator extends AbstractSpecialCardValidator {
  protected readonly specialValue = 'JUMP';

  protected canPlayWhenAttackStack(): boolean {
    return false;
  }

  protected canPlayWhenNoAttackStack(
    ctx: SpecialCardRuleContext,
  ): boolean {
    return this.isSameSuit(ctx) || this.isSameValue(ctx);
  }

  protected getInvalidPlayMessage(): string {
    return 'Cannot play skip card in current state';
  }
}
