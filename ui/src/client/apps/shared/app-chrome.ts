/**
 * AppChrome — the one header every app shares.
 *
 * The shell owns chrome: a wordmark, the app title, live connection status,
 * a preset switcher for compositions, and a `controls` slot for contextual
 * toolbars. Surfaces never draw a header again.
 */

import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { $connectionState } from '../../kernel/index.js';
import { getCompositions, compositionFor, type Composition } from '../../framework/composition.js';

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
    .preset-switcher {
      position: relative;
    }
    .preset-switcher select {
      background: var(--colors-semantic-bg-base);
      color: var(--colors-semantic-text-primary);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 6px;
      padding: 4px 28px 4px 10px;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 6px center;
    }
    .preset-switcher select:focus {
      outline: none;
      border-color: var(--colors-semantic-accent-cyan, #4cc9f0);
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
  @property({ type: Boolean }) showPresetSwitcher = false;

  @state() private connectionState: ConnectionState = 'disconnected';
  @state() private compositions: readonly { id: string; name: string }[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this.watchWith($connectionState, (state) => (this.connectionState = state));
    if (this.showPresetSwitcher) {
      this.refreshCompositions();
    }
  }

  private refreshCompositions(): void {
    this.compositions = getCompositions().map((c) => ({ id: c.id, name: c.name }));
  }

  private onPresetChange = (e: Event): void => {
    const target = e.target as HTMLSelectElement;
    const compositionId = target.value;
    const composition = compositionFor(compositionId);
    if (composition) {
      this.dispatchEvent(
        new CustomEvent<Composition>('preset-change', {
          detail: composition,
          bubbles: true,
          composed: true,
        })
      );
    }
  };

  protected override render(): TemplateResult {
    return html`
      <header>
        <span class="wordmark">SeNARS${this.appTitle ? html` <span>${this.appTitle}</span>` : ''}</span>
        ${this.tagline ? html`<span class="tagline">${this.tagline}</span>` : ''}
        <div class="controls">
          ${this.showPresetSwitcher && this.compositions.length > 0
            ? html`
                <div class="preset-switcher">
                  <select @change=${this.onPresetChange} aria-label="Select preset">
                    ${this.compositions.map(
                      (c) => html`<option value=${c.id} ?selected=${c.name === this.tagline}>${c.name}</option>`
                    )}
                  </select>
                </div>
              `
            : nothing}
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
  interface HTMLElementEventMap {
    'preset-change': CustomEvent<{ readonly id: string; readonly name: string }>;
  }
}
