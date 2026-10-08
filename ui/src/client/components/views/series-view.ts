import { css, html, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { registerViewAdapter } from '../../core/view-adapter.js';
import type { Budget, SeriesDataset, SeriesDatum, ViewSelection } from '../../core/view-spec.js';
import { theme } from '../../utils/theme.js';
import { linePoints } from './series-geometry.js';

const HEIGHT = 60;

/** Renders a `SeriesDataset` as a full SVG line chart with a legend. */
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
    return html`
      <svg class="chart" viewBox="0 0 100 ${HEIGHT}" preserveAspectRatio="none"
        role="img" aria-label="Series chart">
        ${series.map((s) => this.line(s))}
      </svg>
      <ul class="legend">
        ${series.map(
          (s) => html`<li>
            <span class="dot" style="background:${s.color ?? theme.colors.info}"></span>${s.label}
          </li>`
        )}
      </ul>
    `;
  }

  private line(s: SeriesDatum) {
    return svg`<polyline class="line" points=${linePoints(s.values, HEIGHT)} fill="none"
      stroke=${s.color ?? theme.colors.info} vector-effect="non-scaling-stroke" />`;
  }
}

registerViewAdapter({
  shape: 'series',
  tag: 's-series',
  budgets: ['full'],
  interactions: ['select', 'highlight'],
});