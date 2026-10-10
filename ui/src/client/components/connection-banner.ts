import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $connectionState, BaseComponent } from '../core/index.js';
import { $reconnectAttempt } from '../core/ws-client.js';
import './primitives/banner.js';

const MESSAGES: Record<string, string> = {
  connecting: 'Connecting to SeNARS…',
  disconnected: 'Connection lost. Messages are queued.',
  standalone: 'Running in standalone mode (no backend)',
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
    if (state === 'connected' || state === 'standalone' || this.dismissed || !MESSAGES[state]) return '';

    // After the early return, TypeScript narrows the type. Cast to full union to avoid narrowing issues.
    const fullState = state as 'connecting' | 'disconnected' | 'reconnecting' | 'standalone';
    const isConnecting = fullState === 'connecting';
    const isStandalone = fullState === 'standalone';
    const isReconnecting = fullState === 'reconnecting';
    const isDisconnected = fullState === 'disconnected';

    const message =
      isReconnecting
        ? `Connection lost. Reconnecting (attempt ${this.reconnectAttempt})…`
        : MESSAGES[fullState];

    return html`
      <s-banner variant=${isDisconnected ? 'error' : isReconnecting ? 'warning' : 'info'} dismissible @s-dismiss=${this.handleDismiss}>
        <span slot="icon">${isConnecting ? '⟳' : isStandalone ? '💻' : '⚠'}</span>
        ${message}
        ${isDisconnected ? html`<button class="retry-btn" @click=${this.handleRetry}>Retry</button>` : ''}
      </s-banner>
    `;
  }

  private handleDismiss() {
    this.dismissed = true;
  }

  private handleRetry() {
    import('../core/ws-client.js').then(({ reconnect }) => reconnect());
    this.dismissed = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'connection-banner': ConnectionBanner;
  }
}
