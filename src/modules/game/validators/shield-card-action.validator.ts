import {
  AbstractSpecialCardValidator,
  SpecialCardRuleContext,
} from './abstract-special-card.validator';

export class ShieldCardValidator extends AbstractSpecialCardValidator {
  protected readonly specialValue = 'SHIELD';

  protected canPlayWhenAttackStack(): boolean {
    return true;
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
    return 'Cannot play shield card in current state';
  }
}
