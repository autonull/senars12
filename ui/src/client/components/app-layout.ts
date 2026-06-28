import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $userLevel, $focusTerm, $connectionState } from '../core/store.js';
import './cognitive-hud.js';
import './chat-console.js';
import './config-drawer.js';
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
  @state() private chatCollapsed = false;
  @state() private configOpen = false;

  private unsubs = [
    $connectionState.subscribe(() => this.requestUpdate()),
    $userLevel.subscribe(() => this.requestUpdate()),
    $focusTerm.subscribe(() => this.requestUpdate()),
  ];

  static override styles = css`
    :host { display: grid; height: 100vh; grid-template-columns: 1fr; grid-template-rows: 32px 1fr; background: var(--bg-void); }
    .status-bar { display: flex; align-items: center; gap: 8px; padding: 0 8px; background: var(--bg-panel-solid); border-bottom: 1px solid var(--border-dim); font-family: var(--font-data); font-size: 0.7rem; color: var(--text-dim); }
    .status-bar .spacer { flex: 1; }
    .status-divider { width: 1px; height: 16px; background: var(--border-dim); }

    .content { display: flex; flex-direction: row; min-height: 0; overflow: hidden; }
    .primary-zone { flex: 1; display: flex; flex-direction: row; min-width: 0; }
    .graph-area { flex: 1; min-width: 0; display: flex; flex-direction: row; }
    .graph-area > cognitive-hud { flex: 1; min-height: 0; }

    .chat-panel {
      width: 300px; flex-shrink: 0; display: flex; flex-direction: column;
      border-right: 1px solid var(--border-dim); transition: width 0.2s, opacity 0.2s;
      overflow: hidden;
    }
    .chat-panel.collapsed { width: 28px; min-width: 28px; }
    .chat-panel.collapsed > chat-console { opacity: 0; pointer-events: none; }
    .chat-toggle {
      display: flex; align-items: center; justify-content: center;
      width: 28px; flex-shrink: 0; cursor: pointer; color: var(--text-dim);
      font-family: var(--font-data); font-size: 0.65rem; user-select: none;
      background: var(--bg-panel); border-right: 1px solid var(--border-dim);
    }
    .chat-toggle:hover { color: var(--accent-cyan); background: var(--bg-void); }

    .right-zone {
      display: flex; flex-direction: row; overflow: hidden;
      border-left: 1px solid var(--border-dim);
    }
    .right-zone concept-thread,
    .right-zone config-drawer {
      width: 280px; flex-shrink: 0;
    }
    .right-panel-toggle {
      display: flex; align-items: center; justify-content: center;
      width: 24px; flex-shrink: 0; cursor: pointer; color: var(--text-dim);
      font-family: var(--font-data); font-size: 0.65rem; user-select: none;
      background: var(--bg-panel);
    }
    .right-panel-toggle:hover { color: var(--accent-cyan); background: var(--bg-void); }

    .gear-btn {
      display: flex; align-items: center; gap: 4px;
      background: none; border: 1px solid var(--border-dim); border-radius: 3px;
      color: var(--text-dim); font-family: var(--font-data); font-size: 0.7rem;
      padding: 2px 6px; cursor: pointer;
    }
    .gear-btn:hover { color: var(--accent-cyan); border-color: var(--accent-cyan); }
    .gear-btn.active { color: var(--accent-cyan); border-color: var(--accent-cyan); background: rgba(0,243,255,0.1); }
  `;

  override disconnectedCallback() {
    this.unsubs.forEach((u) => u());
    super.disconnectedCallback();
  }

  private toggleChat() { this.chatCollapsed = !this.chatCollapsed; }
  private toggleConfig() { this.configOpen = !this.configOpen; }

  override render() {
    const state = $connectionState.get();
    const isFull = $userLevel.get() === 'full';
    const showThread = isFull && $focusTerm.get() !== null;
    const showRightPanel = showThread || this.configOpen;

    return html`
      <div class="status-bar">
        <lens-selector style="display:${isFull ? 'inline-block' : 'none'}"></lens-selector>
        <button class="gear-btn ${this.configOpen ? 'active' : ''}"
          data-testid="config-toggle"
          @click=${this.toggleConfig} title="Configuration">
          ⚙
        </button>
        <div class="spacer"></div>
        <contradiction-badge style="display:${isFull ? 'inline-flex' : 'none'}"></contradiction-badge>
        <span style="color:${CONNECTION_COLORS[state]};font-size:0.55rem">${CONNECTION_LABELS[state]}</span>
        <span>${state}</span>
      </div>
      <div class="content">
        <div class="primary-zone">
          <div class="chat-panel ${this.chatCollapsed ? 'collapsed' : ''}">
            <chat-console></chat-console>
          </div>
          <div class="chat-toggle" @click=${this.toggleChat} title="${this.chatCollapsed ? 'Expand chat' : 'Collapse chat'}">
            ${this.chatCollapsed ? '◀' : '▶'}
          </div>
          <div class="graph-area">
            <cognitive-hud></cognitive-hud>
          </div>
        </div>
        ${showRightPanel ? html`
          <div class="right-zone">
            <div class="right-panel-toggle"
              @click=${() => { if (showThread) $focusTerm.set(null); if (this.configOpen) this.configOpen = false; }}
              title="Close panel">▶</div>
            ${showThread ? html`<concept-thread></concept-thread>` : ''}
            ${this.configOpen ? html`<config-drawer></config-drawer>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
}
