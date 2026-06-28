import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $activeLens, $userLevel, $focusTerm, $connectionState } from '../core/store.js';
import './cognitive-hud.js';
import './chat-console.js';
import './config-drawer.js';
import './working-memory.js';
import './telemetry-panel.js';
import './lens-selector.js';
import './concept-thread.js';
import './contradiction-badge.js';

const CONNECTION_LABELS: Record<string, string> = {
  connected: '⬤', connecting: '◌', reconnecting: '◌', disconnected: '○',
};
const CONNECTION_COLORS: Record<string, string> = {
  connected: '#00f3ff', connecting: '#ffb000', reconnecting: '#ffb000', disconnected: '#475569',
};

@customElement('app-layout')
export class AppLayout extends LitElement {
  private unsubs = [
    $connectionState.subscribe(() => this.requestUpdate()),
    $userLevel.subscribe(() => this.requestUpdate()),
    $focusTerm.subscribe(() => this.requestUpdate()),
  ];

  static override styles = css`
    :host { display: grid; height: 100vh; grid-template-columns: 1fr; grid-template-rows: 32px 1fr; background: var(--bg-void); }
    .status-bar { display: flex; align-items: center; gap: 12px; padding: 0 12px; background: var(--bg-panel-solid); border-bottom: 1px solid var(--border-dim); font-family: var(--font-data); font-size: 0.7rem; color: var(--text-dim); }
    .status-bar .spacer { flex: 1; }
    .content { display: flex; flex-direction: row; min-height: 0; overflow: hidden; }
    .main-zone { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .graph-area { flex: 1; display: flex; flex-direction: row; min-height: 0; }
    .chat-panel { height: 200px; flex-shrink: 0; }
  `;

  override disconnectedCallback() {
    this.unsubs.forEach((u) => u());
    super.disconnectedCallback();
  }

  override render() {
    const state = $connectionState.get();
    const isFull = $userLevel.get() === 'full';
    const showThread = isFull && $focusTerm.get() !== null;

    return html`
      <div class="status-bar">
        <lens-selector style="display:${isFull ? 'inline-block' : 'none'}"></lens-selector>
        <div class="spacer"></div>
        <contradiction-badge style="display:${isFull ? 'inline-flex' : 'none'}"></contradiction-badge>
        <span style="color:${CONNECTION_COLORS[state]};font-size:0.55rem">${CONNECTION_LABELS[state]}</span>
        <span>${state}</span>
      </div>
      <div class="content">
        <div class="main-zone">
          <div class="graph-area">
            <cognitive-hud style="flex:1;min-height:0;border-right:1px solid var(--border-dim)"></cognitive-hud>
            ${showThread ? html`<concept-thread style="width:280px;flex-shrink:0"></concept-thread>` : ''}
          </div>
          <chat-console class="chat-panel"></chat-console>
        </div>
        <config-drawer style="width:280px;flex-shrink:0;display:none"></config-drawer>
      </div>
    `;
  }
}
