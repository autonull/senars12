import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $lmStatus, $webllmAvailable, $webllmActive, BaseComponent, send } from '../core/index.js';

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
      font-size: var(--typography-scale-xs); gap: 8px; padding: 2px 8px; flex-wrap: wrap;
    }
    .dot { border-radius: 50%; height: 6px; width: 6px; }
    .ok { background: #4caf50; } .down { background: #ff5252; }
    .muted { opacity: 0.6; }
    .webllm-badge {
      background: var(--colors-semantic-bg-emphasis);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: var(--typography-scale-xxs);
    }
    .webllm-badge.local { background: #e8f5e9; border-color: #4caf50; color: #2e7d32; }
    .run-locally-btn {
      background: var(--colors-semantic-bg-emphasis);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: var(--typography-scale-xxs);
      cursor: pointer;
      transition: all 0.2s;
    }
    .run-locally-btn:hover { background: var(--colors-semantic-bg-hover); }
    .run-locally-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `;

  @state() private provider = 'unknown';
  @state() private model = '';
  @state() private available = false;
  @state() private webllmAvailable = false;
  @state() private webllmActive = false;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($lmStatus);
    this.watch($webllmAvailable);
    this.watch($webllmActive);
    this.watchWith($lmStatus, (data) => {
      this.provider = String(data.provider ?? 'none');
      this.model = String(data.model ?? '');
      this.available = Boolean(data.available);
    });
    this.watchWith($webllmAvailable, (v) => { this.webllmAvailable = v; });
    this.watchWith($webllmActive, (v) => { this.webllmActive = v; });

    // Detect WebGPU availability
    this.webllmAvailable = 'gpu' in navigator;
    send({ type: 'lm.status.request' });
  }

  private async switchToWebLLM() {
    if (!this.webllmAvailable || this.webllmActive) return;
    
    // Send a message to the server to switch provider to webllm
    // The server will need to handle this and update the lm-status
    send({ type: 'lm.switch', provider: 'webllm' });
  }

  override render() {
    const isWebLLM = this.provider === 'webllm';
    const showRunLocally = this.webllmAvailable && !this.webllmActive && !isWebLLM;

    return html`
      <span class="panel">
        <span class="dot ${this.available ? 'ok' : 'down'}"></span>
        <span>LM: ${this.provider}</span>
        <span class="muted">${this.model}</span>
        
        ${isWebLLM ? html`
          <span class="webllm-badge local">🌐 Running locally (WebLLM)</span>
        ` : ''}
        
        ${showRunLocally ? html`
          <button 
            class="run-locally-btn" 
            @click=${this.switchToWebLLM}
            title="Switch to local WebGPU inference"
          >
            🌐 Run locally
          </button>
        ` : ''}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lm-status-panel': LMStatusPanel;
  }
}