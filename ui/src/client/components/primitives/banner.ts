import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

type BannerVariant = 'info' | 'warning' | 'error' | 'success';

@customElement('s-banner')
export class SBanner extends LitElement {
  static override styles = css`
    :host { display: block; }
    .banner { display: flex; align-items: center; gap: var(--spacing-scale-3); padding: var(--spacing-scale-3) var(--spacing-scale-4); font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); line-height: var(--typography-lineHeights-normal); }
    .info { background: rgba(0, 170, 255, 0.1); color: var(--colors-primitive-info); border-bottom: 1px solid rgba(0, 170, 255, 0.2); }
    .warning { background: rgba(255, 170, 0, 0.1); color: var(--colors-primitive-warning); border-bottom: 1px solid rgba(255, 170, 0, 0.2); }
    .error { background: rgba(255, 68, 68, 0.1); color: var(--colors-primitive-error); border-bottom: 1px solid rgba(255, 68, 68, 0.2); }
    .success { background: rgba(0, 204, 136, 0.1); color: var(--colors-primitive-success); border-bottom: 1px solid rgba(0, 204, 136, 0.2); }
    .message { flex: 1; }
    .dismiss { background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; padding: 0; font-size: var(--typography-scale-lg); line-height: 1; }
    .dismiss:hover { opacity: 1; }
    .icon { flex-shrink: 0; }
  `;

  @property({ type: String }) variant: BannerVariant = 'info';
  @property({ type: Boolean }) dismissible = false;

  override render() {
    return html`
      <div class="banner ${classMap({ [this.variant]: true })}">
        <span class="icon"><slot name="icon"></slot></span>
        <span class="message"><slot></slot></span>
        ${this.dismissible ? html`<button class="dismiss" @click=${this.handleDismiss} aria-label="Dismiss">&times;</button>` : ''}
      </div>
    `;
  }

  private handleDismiss() {
    this.dispatchEvent(new CustomEvent('s-dismiss', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-banner': SBanner;
  }
}
