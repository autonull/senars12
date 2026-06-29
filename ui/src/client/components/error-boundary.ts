import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../core/index.js';
import './primitives/button.js';

interface ErrorEntry {
  id: number;
  message: string;
  detail?: string;
  timestamp: number;
}

let errorId = 0;

@customElement('error-boundary')
export class ErrorBoundary extends BaseComponent {
  @state() private errors: ErrorEntry[] = [];
  @state() private showDetail: number | null = null;

  static override styles = css`
    :host { display: contents; }
    .overlay {
      position: fixed; inset: 0; z-index: var(--zIndex-layers-modal);
      background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center;
    }
    .modal {
      background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-default);
      border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-modal);
      max-width: 480px; width: 90%; padding: var(--spacing-scale-6);
    }
    .header { display: flex; align-items: center; gap: var(--spacing-scale-3); margin-bottom: var(--spacing-scale-4); }
    .icon { font-size: 1.5rem; }
    .title { font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-lg); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-primitive-error); }
    .message { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-sm); color: var(--colors-semantic-text-secondary); margin-bottom: var(--spacing-scale-4); line-height: var(--typography-lineHeights-relaxed); }
    .detail-toggle { background: none; border: none; color: var(--colors-semantic-accent-primary); cursor: pointer; font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); padding: 0; }
    .detail { margin-top: var(--spacing-scale-3); padding: var(--spacing-scale-3); background: var(--colors-semantic-bg-base); border-radius: var(--borderRadius-component-input); font-family: var(--typography-fontFamilies-mono); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow: auto; }
    .actions { display: flex; gap: var(--spacing-scale-3); margin-top: var(--spacing-scale-5); }
  `;

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('error', this.handleError);
    window.addEventListener('unhandledrejection', this.handleRejection);
    window.addEventListener('app-error', this.handleAppError as EventListener);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('error', this.handleError);
    window.removeEventListener('unhandledrejection', this.handleRejection);
    window.removeEventListener('app-error', this.handleAppError as EventListener);
  }

  private handleError = (e: ErrorEvent) => {
    this.addError(e.message, e.error?.stack);
    e.preventDefault();
  };

  private handleRejection = (e: PromiseRejectionEvent) => {
    this.addError(String(e.reason ?? 'Unhandled Promise rejection'), e.reason?.stack);
    e.preventDefault();
  };

  private handleAppError = (e: CustomEvent) => {
    this.addError(e.detail?.message ?? 'Application error', e.detail?.detail);
  };

  private addError(message: string, detail?: string) {
    this.errors = [...this.errors, { id: ++errorId, message, detail, timestamp: Date.now() }];
  }

  private dismiss(id: number) {
    this.errors = this.errors.filter((e) => e.id !== id);
    if (this.showDetail === id) this.showDetail = null;
  }

  private retry() {
    this.errors = [];
    import('../core/ws-client.js').then(({ connect }) => connect());
  }

  private reload() {
    window.location.reload();
  }

  private toggleDetail(id: number) {
    this.showDetail = this.showDetail === id ? null : id;
  }

  override render() {
    if (!this.errors.length) return '';
    const latest = this.errors.at(-1)!;

    return html`
      <div class="overlay" role="dialog" aria-modal="true" aria-label="Error">
        <div class="modal">
          <div class="header">
            <span class="icon">⚠</span>
            <span class="title">Something went wrong</span>
          </div>
          <div class="message">${latest.message}</div>
          ${
            latest.detail
              ? html`
            <button class="detail-toggle" @click=${() => this.toggleDetail(latest.id)}>
              ${this.showDetail === latest.id ? 'Hide' : 'Show'} technical details
            </button>
            ${this.showDetail === latest.id ? html`<div class="detail">${latest.detail}</div>` : ''}
          `
              : ''
          }
          <div class="actions">
            <s-button variant="primary" @click=${this.retry}>Retry</s-button>
            <s-button variant="secondary" @click=${this.reload}>Reload</s-button>
            <s-button variant="ghost" @click=${() => this.dismiss(latest.id)}>Dismiss</s-button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'error-boundary': ErrorBoundary;
  }
}
