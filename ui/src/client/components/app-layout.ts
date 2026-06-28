import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
// Import child components to ensure they're defined before this component renders
import './cognitive-hud.js';
import './chat-console.js';
import './config-drawer.js';
import './working-memory.js';
import './telemetry-panel.js';
import { exposeTestApi } from '../core/store.js';
import { connect } from '../core/ws-client.js';
import { $connectionState } from '../core/store.js';

@customElement('app-layout')
export class AppLayout extends LitElement {
  static override styles = css`
    :host { display: grid; height: 100vh; container-type: inline-size; background: var(--bg-void); }
    :host {
      grid-template-columns: 1fr 300px;
      grid-template-rows: 1fr auto auto;
      grid-template-areas:
        "main config"
        "wm config"
        "telemetry telemetry";
    }
    @container (max-width: 900px) {
      :host {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr auto auto auto;
        grid-template-areas:
          "main"
          "wm"
          "telemetry"
          "config";
      }
    }
  `;

  override render() {
    return html`
      <div style="grid-area: main; display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--border-dim);">
        <cognitive-hud style="flex: 1; min-height: 0;"></cognitive-hud>
        <chat-console style="height: 240px; flex-shrink: 0;"></chat-console>
      </div>
      <config-drawer style="grid-area: config; min-height: 0;"></config-drawer>
      <working-memory style="grid-area: wm;"></working-memory>
      <telemetry-panel style="grid-area: telemetry;"></telemetry-panel>
    `;
  }
}
