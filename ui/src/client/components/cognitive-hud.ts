import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import './belief-graph.js';

@customElement('cognitive-hud')
export class CognitiveHud extends LitElement {
  override render() {
    return html`<belief-graph style="width:100%;height:100%;"></belief-graph>`;
  }
}
