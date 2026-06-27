import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('cognitive-hud')
export class CognitiveHud extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; background: var(--bg-void); flex: 1; min-height: 0; }
  `;

  override render() {
    return html`
      <belief-graph style="width:100%;height:100%;"></belief-graph>
    `;
  }
}
