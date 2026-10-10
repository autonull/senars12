/**
 * Error Boundary with typed error taxonomy (§P4.5).
 * Renders appropriate recovery affordances per error class.
 */

import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../core/index.js';
import { UiError, createError, type RecoveryAction } from '../core/error-taxonomy.js';
import './primitives/button.js';

interface ErrorEntry {
  id: number;
  error: UiError;
  timestamp: number;
}

let errorId = 0;

@customElement('error-boundary')
export class ErrorBoundary extends BaseComponent {
  static override styles = css`
    :host { display: contents; }
    .overlay {
      position: fixed; inset: 0; z-index: var(--zIndex-layers-modal);
      background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center;
    }
    .modal {
      background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-default);
      border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-modal);
      max-width: 520px; width: 90%; padding: var(--spacing-scale-6);
    }
    .header { display: flex; align-items: center; gap: var(--spacing-scale-3); margin-bottom: var(--spacing-scale-4); }
    .icon { font-size: 1.5rem; }
    .title { font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-lg); font-weight: var(--typography-fontWeights-semibold); color: var(--colors-primitive-error); flex: 1; }
    .code { font-family: var(--typography-fontFamilies-mono); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); background: var(--colors-semantic-bg-base); padding: 1px 6px; border-radius: var(--borderRadius-component-input); }
    .surface { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .message { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-sm); color: var(--colors-semantic-text-secondary); margin-bottom: var(--spacing-scale-4); line-height: var(--typography-lineHeights-relaxed); }
    .detail-toggle { background: none; border: none; color: var(--colors-semantic-accent-primary); cursor: pointer; font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); padding: 0; }
    .detail { margin-top: var(--spacing-scale-3); padding: var(--spacing-scale-3); background: var(--colors-semantic-bg-base); border-radius: var(--borderRadius-component-input); font-family: var(--typography-fontFamilies-mono); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow: auto; }
    .actions { display: flex; flex-wrap: wrap; gap: var(--spacing-scale-2); margin-top: var(--spacing-scale-5); }
    .recoverable-badge { font-size: var(--typography-scale-xs); color: var(--colors-semantic-success); background: var(--colors-semantic-bg-success); padding: 1px 6px; border-radius: var(--borderRadius-component-input); }
  `;

  @state() private errors: ErrorEntry[] = [];
  @state() private showDetail: number | null = null;

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

  override render() {
    if (!this.errors.length) return '';
    const latest = this.errors.at(-1)!;
    const { error } = latest;
    const actions = error.getRecoveryActions();

    return html`
      <div class="overlay" role="dialog" aria-modal="true" aria-label="Error">
        <div class="modal">
          <div class="header">
            <span class="icon">${this.getIcon(error.severity)}</span>
            <span class="title">${this.getTitle(error)}</span>
            <span class="code">${error.code}</span>
          </div>
          <div class="surface">${error.surface}</div>
          <div class="message">${error.message}</div>
          ${
            error.detail
              ? html`
            <button class="detail-toggle" @click=${() => this.toggleDetail(latest.id)}>
              ${this.showDetail === latest.id ? 'Hide' : 'Show'} technical details
            </button>
            ${this.showDetail === latest.id ? html`<div class="detail">${error.detail}</div>` : ''}
          `
              : ''
          }
          ${
            error.recoverable
              ? html`<span class="recoverable-badge">Recoverable</span>`
              : ''
          }
          <div class="actions">
            ${actions.map(
              (action) => html`
              <s-button
                variant=${action.variant}
                @click=${() => this.executeAction(action, latest.id)}
              >
                ${action.label}
              </s-button>
            `
            )}
          </div>
        </div>
      </div>
    `;
  }

  private getIcon(severity: UiError['severity']): string {
    switch (severity) {
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
    }
  }

  private getTitle(error: UiError): string {
    const titles: Record<string, string> = {
      ConnectionError: 'Connection Lost',
      ReconnectionError: 'Reconnection Failed',
      ConfigError: 'Configuration Error',
      ConfigValidationError: 'Configuration Invalid',
      EngineError: 'Reasoning Engine Error',
      BudgetExhaustedError: 'Budget Exhausted',
      GateRejectedError: 'Gate Rejected',
      ProjectionError: 'Projection Failed',
      GraphRenderError: 'Graph Rendering Failed',
      LayoutError: 'Layout Computation Failed',
      CommandError: 'Command Failed',
      CommandValidationError: 'Invalid Command',
      StorageError: 'Storage Error',
      NetworkError: 'Network Error',
      UnknownError: 'Unknown Error',
    };
    return titles[error.constructor.name] ?? 'Something Went Wrong';
  }

  private handleError = (e: ErrorEvent) => {
    this.addError(createError({ message: e.message, detail: e.error?.stack, surface: 'global' }));
    e.preventDefault();
  };

  private handleRejection = (e: PromiseRejectionEvent) => {
    this.addError(createError({ message: String(e.reason ?? 'Unhandled Promise rejection'), detail: e.reason?.stack, surface: 'global' }));
    e.preventDefault();
  };

  private handleAppError = (e: CustomEvent) => {
    const detail = e.detail;
    if (detail?.error && typeof detail.error === 'object' && 'code' in detail.error) {
      this.addError(createError(detail.error as { message: string; detail?: string; code?: string; surface?: string }));
    } else {
      this.addError(createError({ message: detail?.message ?? 'Application error', detail: detail?.detail, surface: 'app' }));
    }
  };

  private addError(error: UiError) {
    this.errors = [...this.errors, { id: ++errorId, error, timestamp: Date.now() }];
  }

  private dismiss(id: number) {
    this.errors = this.errors.filter((e) => e.id !== id);
    if (this.showDetail === id) this.showDetail = null;
  }

  private async executeAction(action: RecoveryAction, errorId: number) {
    try {
      await action.action();
    } catch (err) {
      console.error('Recovery action failed:', err);
    }
    this.dismiss(errorId);
  }

  private toggleDetail(id: number) {
    this.showDetail = this.showDetail === id ? null : id;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'error-boundary': ErrorBoundary;
  }
}