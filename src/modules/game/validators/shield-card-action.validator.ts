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
    return this.isSameSuit(ctx) || this.isSameValue(ctx);
  }

  protected getInvalidPlayMessage(): string {
    return 'Cannot play shield card in current state';
  }
}
