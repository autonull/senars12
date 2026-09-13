import type { IncomingFromServer } from '@senars/core';
import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $lmStatus, BaseComponent, send } from '../core/index.js';

/**
 * Small status strip answering "which model am I actually using?"
 * Data source: the `lm.status` WS message (mirrors the `nar://lm-status` resource).
 */
@customElement('lm-status-panel')
export class LMStatusPanel extends BaseComponent {
  static override styles = css`
    :host { display: block; }
    .panel {
      align-items: center; display: flex; font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-xs); gap: 8px; padding: 2px 8px;
    }
    .dot { border-radius: 50%; height: 6px; width: 6px; }
    .ok { background: #4caf50; } .down { background: #ff5252; }
    .muted { opacity: 0.6; }
  `;

  @state() private provider = 'unknown';
  @state() private model = '';
  @state() private available = false;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($lmStatus);
    this.watchWith($lmStatus, (data) => {
      this.provider = String(data.provider ?? 'none');
      this.model = String(data.model ?? '');
      this.available = Boolean(data.available);
    });
    send({ type: 'lm.status.request' });
  }

  override render() {
    return html`
      <span class="panel">
        <span class=${this.available ? 'ok' : 'down'}></span>
        <span>LM: ${this.provider}</span>
        <span class="muted">${this.model}</span>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lm-status-panel': LMStatusPanel;
  }
}
