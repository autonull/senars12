import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { registerViewAdapter } from '../../core/view-adapter.js';
import { formatCell } from '../../core/view-projection.js';
import type { TableDataset, ViewSelection } from '../../core/view-spec.js';

const TOP_N = 5;

/**
 * The embedded table variant. A single row renders as key-value pairs (the
 * inspector shape); many rows render as a top-N table with a remainder hint.
 */
@customElement('s-table-mini')
export class TableMiniView extends BaseComponent {
  static override styles = css`
    :host { display: block; overflow: auto; font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 1px var(--spacing-scale-2); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    th { color: var(--colors-semantic-text-muted); font-weight: var(--typography-fontWeights-semibold); text-transform: uppercase; letter-spacing: 0.5px; }
    td { color: var(--colors-semantic-text-secondary); font-variant-numeric: tabular-nums; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 0 var(--spacing-scale-2); margin: 0; }
    dt { color: var(--colors-semantic-text-muted); }
    dd { margin: 0; color: var(--colors-semantic-text-secondary); font-variant-numeric: tabular-nums; text-align: right; }
    .more { padding: 1px var(--spacing-scale-2); color: var(--colors-semantic-text-muted); }
    .empty { padding: 1px var(--spacing-scale-2); color: var(--colors-semantic-text-muted); }
  `;
  @property({ attribute: false }) data: TableDataset | null = null;
  @property({ attribute: false }) selection: ViewSelection | null = null;

  override render() {
    const dataset = this.data;
    if (!dataset || dataset.rows.length === 0) return html`<div class="empty">No rows</div>`;
    return dataset.rows.length === 1 ? this.keyValue(dataset) : this.topN(dataset);
  }

  private keyValue(dataset: TableDataset) {
    const row = dataset.rows[0]!;
    return html`<dl>
      ${dataset.columns.map(
        (column) => html`<dt>${column.label}</dt><dd>${formatCell(row[column.id])}</dd>`
      )}
    </dl>`;
  }

  private topN(dataset: TableDataset) {
    const shown = dataset.rows.slice(0, TOP_N);
    const hidden = dataset.rows.length - shown.length;
    return html`
      <table>
        <tbody>
          ${shown.map(
            (row) => html`<tr>
              ${dataset.columns.map((column) => html`<td>${formatCell(row[column.id])}</td>`)}
            </tr>`
          )}
        </tbody>
      </table>
      ${hidden > 0 ? html`<div class="more">+${hidden} more</div>` : ''}
    `;
  }
}

registerViewAdapter({
  shape: 'table',
  tag: 's-table-mini',
  budgets: ['embedded'],
  interactions: ['select', 'multi-select', 'filter', 'highlight'],
});