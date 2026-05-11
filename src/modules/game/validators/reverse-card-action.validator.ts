import {
  AbstractSpecialCardValidator,
  SpecialCardRuleContext,
} from './abstract-special-card.validator';

export class ReverseCardValidator extends AbstractSpecialCardValidator {
  protected readonly specialValue = 'REVERSE';

  protected canPlayWhenAttackStack(): boolean {
    return false;
  }

  protected canPlayWhenNoAttackStack(
    ctx: SpecialCardRuleContext,
  ): boolean {
    return this.isSameSuit(ctx) || this.isSameValue(ctx);
  }

  protected getInvalidPlayMessage(): string {
    return 'Cannot play reverse card in current state';
  }
}
