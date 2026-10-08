import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { registerViewAdapter } from '../../core/view-adapter.js';
import type { Budget, TextDataset } from '../../core/view-spec.js';

const EMBEDDED_LINES = 6;

/** Renders a `TextDataset` as a log/preformatted block; embedded keeps the tail. */
@customElement('s-text')
export class TextView extends BaseComponent {
  static override styles = css`
    :host { display: block; overflow: auto; }
    pre {
      margin: 0; padding: var(--spacing-scale-2) var(--spacing-scale-3);
      font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-secondary); white-space: pre-wrap; word-break: break-word;
    }
    .empty { padding: var(--spacing-scale-3); color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-xs); }
  `;
  @property({ attribute: false }) data: TextDataset | null = null;
  @property({ attribute: false }) budget: Budget = 'full';

  override render() {
    const lines = this.data?.lines ?? [];
    if (lines.length === 0) return html`<div class="empty">No lines</div>`;
    const shown = this.budget === 'embedded' ? lines.slice(-EMBEDDED_LINES) : lines;
    return html`<pre>${shown.join('\n')}</pre>`;
  }
}

registerViewAdapter({
  shape: 'text',
  tag: 's-text',
  budgets: ['full', 'embedded'],
  interactions: ['select', 'filter'],
});