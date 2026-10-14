/**
 * AppChrome — the one header every app shares.
 *
 * The shell owns chrome: a wordmark, the app title, live connection status, and
 * a `controls` slot for contextual toolbars. Surfaces never draw a header again.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { $connectionState } from '../../kernel/index.js';

type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'standalone';

@customElement('app-chrome')
export class AppChrome extends BaseComponent {
  static override styles = css`
    :host {
      display: block;
      flex: 0 0 auto;
    }
    header {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2, 8px);
      padding: 10px 16px;
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      background: var(--colors-semantic-bg-panel-solid);
      flex-wrap: wrap;
    }
    .wordmark {
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .wordmark span {
      color: var(--colors-semantic-accent-cyan, #4cc9f0);
    }
    .title {
      font-weight: 600;
    }
    .tagline {
      font-size: 12.5px;
      color: var(--colors-semantic-text-muted);
    }
    .controls {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--colors-semantic-text-muted);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--colors-semantic-text-muted);
    }
    .dot.connected {
      background: #46c07a;
    }
    .dot.disconnected {
      background: #e5534b;
    }
    .dot.connecting,
    .dot.reconnecting {
      background: #d8a657;
    }
  `;

  @property({ type: String }) appTitle = '';
  @property({ type: String }) tagline = '';

  @state() private connectionState: ConnectionState = 'disconnected';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watchWith($connectionState, (state) => (this.connectionState = state));
  }

  protected override render(): TemplateResult {
    return html`
      <header>
        <span class="wordmark">SeNARS${this.appTitle ? html` <span>${this.appTitle}</span>` : ''}</span>
        ${this.tagline ? html`<span class="tagline">${this.tagline}</span>` : ''}
        <div class="controls">
          <slot name="controls"></slot>
          <span class="status">
            <span class="dot ${this.connectionState}"></span>${this.connectionState}
          </span>
        </div>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-chrome': AppChrome;
  }
}
