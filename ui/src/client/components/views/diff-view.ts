import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { registerViewAdapter } from '../../core/view-adapter.js';
import type { Budget, DiffDataset, DiffLine } from '../../core/view-spec.js';
import { highlightLine, highlightStyles } from './token-render.js';

const EMBEDDED_LINES = 12;
const SIGN: Record<DiffLine['kind'], string> = { add: '+', del: '-', context: ' ' };

/** Renders a `DiffDataset` as a unified diff with a sign gutter and token highlighting. */
@customElement('s-diff')
export class DiffView extends BaseComponent {
  static override styles = [
    highlightStyles,
    css`
      :host { display: block; overflow: auto; }
      .diff {
        display: flex; flex-direction: column; background: var(--colors-semantic-bg-base);
        border-radius: 6px; font-family: var(--typography-fontFamilies-data);
        font-size: var(--typography-scale-xs); line-height: 1.5; overflow-x: auto;
      }
      .row {
        display: flex; gap: var(--spacing-scale-2); padding: 0 var(--spacing-scale-3);
        white-space: pre; border-left: 2px solid transparent;
      }
      .row.add {
        border-left-color: var(--colors-semantic-status-connected);
        background: color-mix(in srgb, var(--colors-semantic-status-connected) 12%, transparent);
      }
      .row.del {
        border-left-color: var(--colors-semantic-status-disconnected);
        background: color-mix(in srgb, var(--colors-semantic-status-disconnected) 12%, transparent);
      }
      .sign { user-select: none; color: var(--colors-semantic-text-muted); }
      .row.add .sign { color: var(--colors-semantic-status-connected); }
      .row.del .sign { color: var(--colors-semantic-status-disconnected); }
      .more { padding: var(--spacing-scale-1) var(--spacing-scale-3); color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-xs); }
      .empty { padding: var(--spacing-scale-3); color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-xs); }
    `,
  ];
  @property({ attribute: false }) data: DiffDataset | null = null;
  @property({ attribute: false }) budget: Budget = 'full';

  override render() {
    const lines = this.data?.lines ?? [];
    if (lines.length === 0) return html`<div class="empty">No changes</div>`;
    const language = this.data?.language;
    const shown = this.budget === 'embedded' ? lines.slice(0, EMBEDDED_LINES) : lines;
    return html`
      <div class="diff" data-language=${language ?? ''}>
        ${shown.map(
          (line) => html`<div class="row ${line.kind}">
            <span class="sign" aria-hidden="true">${SIGN[line.kind]}</span>
            <span class="text">${highlightLine(line.text, language)}</span>
          </div>`
        )}
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
  shape: 'diff',
  tag: 's-diff',
  budgets: ['full', 'embedded'],
  interactions: ['select'],
});
