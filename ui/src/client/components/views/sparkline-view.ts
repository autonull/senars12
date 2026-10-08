import { css, html, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from '../../core/base-component.js';
import { registerViewAdapter } from '../../core/view-adapter.js';
import type { SeriesDataset, ViewSelection } from '../../core/view-spec.js';
import { theme } from '../../utils/theme.js';
import { linePoints } from './series-geometry.js';

const HEIGHT = 24;

/** The embedded series variant: a bare sparkline, no legend or chrome. */
@customElement('s-sparkline')
export class SparklineView extends BaseComponent {
  static override styles = css`
    :host { display: block; }
    .chart { display: block; width: 100%; height: 100%; min-height: 16px; }
    .empty { padding: 0 var(--spacing-scale-2); color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-xs); }
  `;
  @property({ attribute: false }) data: SeriesDataset | null = null;
  @property({ attribute: false }) selection: ViewSelection | null = null;

  override render() {
    const series = this.data?.series ?? [];
    if (series.length === 0) return html`<div class="empty">No series</div>`;
    return html`
      <svg class="chart" viewBox="0 0 100 ${HEIGHT}" preserveAspectRatio="none"
        role="img" aria-label="Sparkline">
        ${series.map(
          (s) => svg`<polyline points=${linePoints(s.values, HEIGHT)} fill="none"
            stroke=${s.color ?? theme.colors.info} vector-effect="non-scaling-stroke" />`
        )}
      </svg>
    `;
  }
}

registerViewAdapter({
  shape: 'series',
  tag: 's-sparkline',
  budgets: ['embedded'],
  interactions: ['select', 'highlight'],
});