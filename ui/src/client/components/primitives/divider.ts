import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

type DividerOrientation = 'horizontal' | 'vertical';

@customElement('s-divider')
export class SDivider extends LitElement {
  static override styles = css`
    :host { display: flex; }
    .horizontal { width: 100%; height: 1px; background: var(--colors-semantic-border-subtle); margin: var(--spacing-scale-3) 0; }
    .vertical { width: 1px; height: 100%; min-height: 20px; background: var(--colors-semantic-border-subtle); margin: 0 var(--spacing-scale-3); }
  `;

  @property({ type: String }) orientation: DividerOrientation = 'horizontal';

  override render() {
    return html`<div class="${classMap({ [this.orientation]: true })}"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-divider': SDivider;
  }
}
