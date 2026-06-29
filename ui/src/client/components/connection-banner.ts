import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $connectionState } from '../core/index.js';
import { BaseComponent } from '../core/index.js';
import './primitives/banner.js';

const MESSAGES: Record<string, string> = {
  connecting: 'Connecting to SeNARS…',
  reconnecting: 'Connection lost. Reconnecting…',
  disconnected: 'Offline. Messages will be queued.',
  connected: '',
};

@customElement('connection-banner')
export class ConnectionBanner extends BaseComponent {
  @state() private dismissed = false;
  @state() private reconnectCountdown = 0;
  private countdownInterval: number | undefined;

  static override styles = css`
    :host { display: block; }
    .retry-btn {
      background: none; border: 1px solid currentColor; border-radius: var(--borderRadius-component-button);
      color: inherit; font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-xs); padding: 2px 8px; cursor: pointer;
    }
    .retry-btn:hover { opacity: 0.8; }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($connectionState, (state) => {
      this.dismissed = false;
      if (state === 'reconnecting') {
        this.reconnectCountdown = 3;
        this.clearCountdown();
        this.countdownInterval = window.setInterval(() => {
          this.reconnectCountdown = Math.max(0, this.reconnectCountdown - 1);
        }, 1000);
      } else {
        this.clearCountdown();
      }
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.clearCountdown();
  }

  private clearCountdown() {
    if (this.countdownInterval !== undefined) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
  }

  private handleDismiss() { this.dismissed = true; }
  private handleRetry() {
    import('../core/ws-client.js').then(({ connect }) => connect());
    this.dismissed = true;
  }

  override render() {
    const state = $connectionState.get();
    if (state === 'connected' || this.dismissed || !MESSAGES[state]) return '';

    const message = state === 'reconnecting'
      ? `Connection lost. Reconnecting in ${this.reconnectCountdown}s…`
      : MESSAGES[state];

    return html`
      <s-banner variant=${state === 'disconnected' ? 'error' : state === 'reconnecting' ? 'warning' : 'info'} dismissible @s-dismiss=${this.handleDismiss}>
        <span slot="icon">${state === 'connecting' ? '⟳' : '⚠'}</span>
        ${message}
        ${state === 'disconnected' ? html`<button class="retry-btn" @click=${this.handleRetry}>Retry</button>` : ''}
      </s-banner>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'connection-banner': ConnectionBanner; }
}
