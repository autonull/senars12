import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $connectionState, BaseComponent } from '../core/index.js';
import { $reconnectAttempt } from '../core/ws-client.js';
import './primitives/banner.js';

const MESSAGES: Record<string, string> = {
  connecting: 'Connecting to SeNARS…',
  disconnected: 'Connection lost. Messages are queued.',
  connected: '',
};

@customElement('connection-banner')
export class ConnectionBanner extends BaseComponent {
  static override styles = css`
    :host { display: block; }
    .retry-btn {
      background: none; border: 1px solid currentColor; border-radius: var(--borderRadius-component-button);
      color: inherit; font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-xs); padding: 2px 8px; cursor: pointer;
    }
    .retry-btn:hover { opacity: 0.8; }
  `;
  @state() private dismissed = false;
  @state() private reconnectAttempt = 0;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($connectionState);
    this.watchWith($reconnectAttempt, (n) => {
      this.reconnectAttempt = n;
    });
  }

  override render() {
    const state = $connectionState.get();
    if (state === 'connected' || this.dismissed || !MESSAGES[state]) return '';

    const message =
      state === 'reconnecting'
        ? `Connection lost. Reconnecting (attempt ${this.reconnectAttempt})…`
        : MESSAGES[state];

    return html`
      <s-banner variant=${state === 'disconnected' ? 'error' : state === 'reconnecting' ? 'warning' : 'info'} dismissible @s-dismiss=${this.handleDismiss}>
        <span slot="icon">${state === 'connecting' ? '⟳' : '⚠'}</span>
        ${message}
        ${state === 'disconnected' ? html`<button class="retry-btn" @click=${this.handleRetry}>Retry</button>` : ''}
      </s-banner>
    `;
  }

  private handleDismiss() {
    this.dismissed = true;
  }

  private handleRetry() {
    import('../core/ws-client.js').then(({ connect }) => connect());
    this.dismissed = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'connection-banner': ConnectionBanner;
  }
}
