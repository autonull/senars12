import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { registerViewAdapter } from '../../core/view-adapter.js';
import { formatCell } from '../../core/view-projection.js';
import type { Budget, TableDataset, ViewSelection } from '../../core/view-spec.js';

/** Renders a full `TableDataset`; a row click selects its id. */
@customElement('s-table')
export class TableView extends BaseComponent {
  static override styles = css`
    :host { display: block; overflow: auto; }
    table { width: 100%; border-collapse: collapse; font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); }
    th, td { text-align: left; padding: var(--spacing-scale-1) var(--spacing-scale-2); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    th { color: var(--colors-semantic-text-muted); font-weight: var(--typography-fontWeights-semibold); text-transform: uppercase; letter-spacing: 0.5px; }
    td { color: var(--colors-semantic-text-secondary); font-variant-numeric: tabular-nums; }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: var(--colors-semantic-bg-panel-hover); }
    tbody tr.selected { background: var(--colors-semantic-accent-primary-subtle); }
    .empty { padding: var(--spacing-scale-3); color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-xs); }
  `;
  @property({ attribute: false }) data: TableDataset | null = null;
  @property({ attribute: false }) budget: Budget = 'full';
  @property({ attribute: false }) selection: ViewSelection | null = null;

  override render() {
    const dataset = this.data;
    if (!dataset || dataset.rows.length === 0) return html`<div class="empty">No rows</div>`;
    const selected = this.selection?.focus;
    return html`
      <table>
        <thead>
          <tr>${dataset.columns.map((column) => html`<th scope="col">${column.label}</th>`)}</tr>
        </thead>
        <tbody>
          ${dataset.rows.map((row, index) => {
            const id = String(row.id ?? index);
            return html`<tr class=${id === selected ? 'selected' : ''} @click=${() => this.select(id)}>
              ${dataset.columns.map((column) => html`<td>${formatCell(row[column.id])}</td>`)}
            </tr>`;
          })}
        </tbody>
      </table>
    `;
  }

  private select(id: string): void {
    this.dispatchEvent(
      new CustomEvent('view-select', { detail: { id }, bubbles: true, composed: true })
    );
  }
}

registerViewAdapter({
  shape: 'table',
  tag: 's-table',
  budgets: ['full'],
  interactions: ['select', 'multi-select', 'filter', 'highlight'],
});