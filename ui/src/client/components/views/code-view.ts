import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { registerViewAdapter } from '../../core/view-adapter.js';
import type { Budget, CodeDataset } from '../../core/view-spec.js';
import { highlightLine, highlightStyles } from './token-render.js';

const EMBEDDED_LINES = 8;

/** Renders a `CodeDataset` with a line-number gutter and light token highlighting. */
@customElement('s-code')
export class CodeView extends BaseComponent {
  static override styles = [
    highlightStyles,
    css`
      :host { display: block; overflow: auto; }
      .code {
        display: grid; grid-template-columns: auto 1fr; margin: 0;
        background: var(--colors-semantic-bg-base); border-radius: 6px;
        font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs);
        line-height: 1.5;
      }
      .gutter {
        display: flex; flex-direction: column; padding: var(--spacing-scale-2);
        text-align: right; color: var(--colors-semantic-text-muted); user-select: none;
        background: var(--colors-semantic-bg-subtle);
        border-right: 1px solid var(--colors-semantic-border-subtle);
      }
      .body {
        display: flex; flex-direction: column; padding: var(--spacing-scale-2) var(--spacing-scale-3);
        overflow-x: auto;
      }
      .line { white-space: pre; min-height: 1.5em; }
      .more { padding: var(--spacing-scale-1) var(--spacing-scale-3); color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-xs); }
      .empty { padding: var(--spacing-scale-3); color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-xs); }
    `,
  ];
  @property({ attribute: false }) data: CodeDataset | null = null;
  @property({ attribute: false }) budget: Budget = 'full';

  override render() {
    const lines = this.data?.lines ?? [];
    if (lines.length === 0) return html`<div class="empty">No code</div>`;
    const language = this.data?.language;
    const shown = this.budget === 'embedded' ? lines.slice(0, EMBEDDED_LINES) : lines;
    return html`
      <div class="code" data-language=${language ?? ''}>
        <div class="gutter" aria-hidden="true">
          ${shown.map((_, index) => html`<span>${index + 1}</span>`)}
        </div>
        <div class="body">
          ${shown.map((line) => html`<div class="line">${highlightLine(line, language)}</div>`)}
        </div>
      </div>
      ${
        this.budget === 'embedded' && lines.length > shown.length
          ? html`<div class="more">… ${lines.length - shown.length} more lines</div>`
          : ''
      }
    `;
  }
}

registerViewAdapter({
  shape: 'code',
  tag: 's-code',
  budgets: ['full', 'embedded'],
  interactions: ['select'],
});
