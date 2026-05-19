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
    return (
      this.isSameSuit(
        ctx.lastCard,
        ctx.card,
      ) ||
      this.isSameValue(
        ctx.lastCard,
        ctx.card,
      )
    );
  }

  protected getInvalidPlayMessage(): string {
    return 'Cannot play reverse card in current state';
  }
}
