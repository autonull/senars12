import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import './belief-graph.js';

@customElement('cognitive-hud')
export class CognitiveHud extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; background: var(--bg-void); flex: 1; min-height: 0; }
  `;

  constructor() {
    super();
    console.log('CognitiveHud constructor');
  }

  override connectedCallback() {
    super.connectedCallback();
    console.log('CognitiveHud connectedCallback');
  }

  override render() {
    console.log('CognitiveHud render');
    return html`
      <belief-graph style="width:100%;height:100%;"></belief-graph>
    `;
  }
}
