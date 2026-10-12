import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';

/**
 * Split panel (E3): a first-class panel kind for side-by-side or stacked
 * workspace views. Placeholder — the split view logic lives in the renderer
 * layer; this panel surfaces the controls.
 */
@customElement('split-panel')
export class SplitPanel extends BaseComponent {
  static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; }
    .placeholder {
      flex: 1; display: flex; align-items: center; justify-content: center;
      color: var(--colors-semantic-text-muted);
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-sm);
    }
  `;

  override render() {
    return html`
      <s-panel heading="Split" docked="bottom" closable @s-close=${this.handleClose}>
        <div class="placeholder">Split view — coming in E3</div>
      </s-panel>
    `;
  }

  private handleClose() {
    import('../core/store.js').then(({ togglePanel }) => togglePanel('split'));
  }
}

declare global {
  interface HTMLElementTagNameMap { 'split-panel': SplitPanel; }
}