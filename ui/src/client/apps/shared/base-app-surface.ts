/**
 * BaseAppSurface — shared app layout: header, toolbar, viewport, empty state.
 *
 * Subclasses provide:
 *  - `appTitle`: wordmark suffix (e.g. "Goals", "Explore")
 *  - `appTagline`: subtitle in header
 *  - `renderToolbar()`: optional toolbar content
 *  - `renderViewport()`: main viewport content
 *  - `renderEmptyState()`: empty state when no content
 *  - `renderStats()`: optional stats overlay
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  $connectionState,
  BaseComponent,
} from '../../kernel/index.js';

type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'standalone';

export interface BaseAppSurfaceConfig {
  appTitle: string;
  appTagline: string;
}

@customElement('base-app-surface')
export class BaseAppSurface extends BaseComponent {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--colors-semantic-bg-base);
      color: var(--colors-semantic-text-primary);
      font-family: var(--typography-fontFamilies-ui, system-ui, sans-serif);
    }
    .app {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    header {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2, 8px);
      padding: 12px 24px;
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      background: var(--colors-semantic-bg-panel-solid);
      flex: 0 0 auto;
    }
    .wordmark {
      font-weight: 650;
      letter-spacing: 0.02em;
    }
    .tagline {
      font-size: 13px;
      color: var(--colors-semantic-text-muted);
    }
    .toolbar {
      display: flex;
      gap: 8px;
      margin-left: auto;
      flex-wrap: wrap;
      align-items: center;
    }
    .toolbar-group {
      display: flex;
      gap: 4px;
      padding: 0 8px;
      border-left: 1px solid var(--colors-semantic-border-subtle);
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
    .viewport {
      flex: 1;
      position: relative;
      overflow: hidden;
      min-height: 0;
    }
    .viewport > * {
      width: 100%;
      height: 100%;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--colors-semantic-text-muted);
      text-align: center;
      padding: 24px;
    }
    .empty h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--colors-semantic-text-primary);
      margin: 0 0 8px;
    }
    .stats {
      display: flex;
      gap: 24px;
      margin-top: 16px;
      font-size: 14px;
    }
    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--colors-semantic-accent-primary, #6ea8fe);
    }
    .stat-label {
      font-size: 12px;
      color: var(--colors-semantic-text-muted);
    }
  `;

  @state() private connectionState: ConnectionState = 'disconnected';

  override connectedCallback(): void {
    super.connectedCallback();
    this.watchWith($connectionState, (s) => (this.connectionState = s));
  }

  protected renderHeader(): TemplateResult {
    return html`
      <header>
        <span class="wordmark">SeNARS</span>
        <span class="tagline">${this.appTagline}</span>
        <div class="toolbar">
          ${this.renderToolbar()}
          <span class="status">
            <span class="dot ${this.connectionState}"></span>${this.connectionState}
          </span>
        </div>
      </header>
    `;
  }

  protected renderViewport(): TemplateResult {
    return html`<div class="viewport">${this.renderViewportContent()}</div>`;
  }

  protected renderViewportContent(): TemplateResult {
    const hasContent = this.hasViewportContent();
    return hasContent
      ? html`
          ${this.renderViewportContentImpl()}
          ${this.renderStats()}
        `
      : this.renderEmptyState();
  }

  protected override render(): TemplateResult {
    return html`
      <div class="app">
        ${this.renderHeader()}
        ${this.renderViewport()}
      </div>
    `;
  }

  // Subclass hooks
  protected get appTitle(): string { return ''; }
  protected get appTagline(): string { return ''; }

  protected renderToolbar(): TemplateResult | typeof nothing { return nothing; }

  protected hasViewportContent(): boolean { return true; }

  protected renderViewportContentImpl(): TemplateResult | typeof nothing { return nothing; }

  protected renderEmptyState(): TemplateResult {
    return html`
      <div class="empty">
        <h2>No data</h2>
        <p>Connect to a backend to get started.</p>
      </div>
    `;
  }

  protected renderStats(): TemplateResult | typeof nothing { return nothing; }
}

declare global {
  interface HTMLElementTagNameMap {
    'base-app-surface': BaseAppSurface;
  }
}