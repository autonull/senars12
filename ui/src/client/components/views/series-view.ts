import { css, html, nothing, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { registerViewAdapter } from '../../core/view-adapter.js';
import type { Budget, SeriesDataset, SeriesDatum, ViewSelection } from '../../core/view-spec.js';
import { theme } from '../../utils/theme.js';

/** Renders a `SeriesDataset` as an SVG line chart; embedded drops the legend and shrinks. */
@customElement('s-series')
export class SeriesView extends BaseComponent {
  static override styles = css`
    :host { display: block; }
    .chart { display: block; width: 100%; height: 100%; min-height: 24px; }
    .empty { padding: var(--spacing-scale-3); color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-xs); }
    .legend {
      display: flex; flex-wrap: wrap; gap: var(--spacing-scale-3); list-style: none;
      margin: var(--spacing-scale-1) 0 0; padding: 0;
      font-family: var(--typography-fontFamilies-data); font-size: 0.6rem;
      color: var(--colors-semantic-text-secondary);
    }
    .legend li { display: flex; align-items: center; gap: 4px; }
    .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
  `;
  @property({ attribute: false }) data: SeriesDataset | null = null;
  @property({ attribute: false }) budget: Budget = 'full';
  @property({ attribute: false }) selection: ViewSelection | null = null;

  override render() {
    const series = this.data?.series ?? [];
    if (series.length === 0) return html`<div class="empty">No series</div>`;
    const height = this.budget === 'embedded' ? 24 : 60;
    return html`
      <svg class="chart" viewBox="0 0 100 ${height}" preserveAspectRatio="none"
        role="img" aria-label="Series chart">
        ${series.map((s) => this.line(s, height))}
      </svg>
      ${this.budget === 'embedded'
        ? nothing
        : html`<ul class="legend">
            ${series.map(
              (s) => html`<li>
                <span class="dot" style="background:${s.color ?? theme.colors.info}"></span>${s.label}
              </li>`
            )}
          </ul>`}
    `;
  }

  private line(s: SeriesDatum, height: number) {
    const max = Math.max(...s.values, 1);
    const step = 100 / Math.max(s.values.length - 1, 1);
    const points = s.values
      .map((value, index) => `${(index * step).toFixed(2)},${(height - (value / max) * height).toFixed(2)}`)
      .join(' ');
    return svg`<polyline class="line" points=${points} fill="none"
      stroke=${s.color ?? theme.colors.info} vector-effect="non-scaling-stroke" />`;
  }
}

registerViewAdapter({
  shape: 'series',
  tag: 's-series',
  budgets: ['full', 'embedded'],
  interactions: ['select', 'highlight'],
});