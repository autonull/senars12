import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $connectionState, $configOpen } from '../core/store.js';
import { BaseComponent } from '../core/base-component.js';
import { CONNECTION_COLORS } from '../constants.js';
import './graph-viewport.js';
import './lens-selector.js';
import './input-hud.js';
import './config-hud.js';
import './contradiction-badge.js';
import './telemetry-panel.js';

@customElement('app-layout')
export class AppLayout extends BaseComponent {
  static override styles = css`
    :host { display: grid; height: 100vh; grid-template-rows: 48px 1fr 60px; background: var(--bg-void); }
    .status-bar { display: flex; align-items: center; gap: 8px; padding: 0 12px; background: var(--bg-panel-solid); border-bottom: 1px solid var(--border-dim); font-family: var(--font-data); font-size: 0.7rem; color: var(--text-dim); z-index: 100; }
    .status-bar .spacer { flex: 1; }
    .gear-btn { display: flex; align-items: center; gap: 4px; background: none; border: 1px solid var(--border-dim); border-radius: 3px; color: var(--text-dim); font-family: var(--font-data); font-size: 0.7rem; padding: 2px 6px; cursor: pointer; }
    .gear-btn:hover { color: var(--accent-cyan); border-color: var(--accent-cyan); }
    .gear-btn.active { color: var(--accent-cyan); border-color: var(--accent-cyan); background: rgba(0,243,255,0.1); }
    .graph-canvas { position: relative; width: 100%; height: 100%; }
    graph-viewport { width: 100%; height: 100%; }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($connectionState);
    this.watch($configOpen);
  }

  private toggleConfig() { $configOpen.set(!$configOpen.get()); }

  override render() {
    const state = $connectionState.get();
    const configOpen = $configOpen.get();
    return html`
  <div class="status-bar">
    <lens-selector></lens-selector>
    <button class="gear-btn ${configOpen ? 'active' : ''}"
      data-testid="config-toggle"
      @click=${this.toggleConfig} title="Configuration">⚙</button>
    <div class="spacer"></div>
    <contradiction-badge></contradiction-badge>
    <span style="color:${CONNECTION_COLORS[state]};font-size:0.55rem">${state === 'connected' ? '⬤' : state === 'disconnected' ? '○' : '◌'}</span>
    <span>${state}</span>
  </div>
  <div class="graph-canvas">
    <graph-viewport></graph-viewport>
  </div>
  <input-hud></input-hud>
  <config-hud></config-hud>
  <telemetry-panel></telemetry-panel>
`;
  }
}