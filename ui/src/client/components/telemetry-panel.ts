import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import {
  $cognitiveMetrics,
  $telemetry,
  BaseComponent,
  mountTestApi,
  type SeriesDataset,
  type SeriesDatum,
  type ViewSpec,
  type ViewSource,
} from '../core/index.js';
import { type FieldId, fieldKey, fieldMeta, formatField, TELEMETRY_FIELDS } from '../utils/field-catalog.js';
import { theme } from '../utils/theme.js';
import {
  TELEMETRY_METRIC_KEYS,
  TELEMETRY_RANGE_POINTS,
  TELEMETRY_RANGES,
  DEFAULT_TELEMETRY_METRICS,
  telemetrySeries,
  type TelemetryRange,
} from '../utils/telemetry-view.js';

@customElement('telemetry-panel')
export class TelemetryPanel extends BaseComponent {
  static override styles = css`
    :host {
      display: block; background: var(--colors-semantic-bg-panel);
      border-top: 1px solid var(--colors-semantic-border-subtle);
      position: relative; container-type: inline-size;
    }
    .telemetry-body { position: relative; }
    .chart-view { display: block; height: 120px; }

    /* Toolbar */
    .toolbar {
      display: flex; align-items: center; gap: var(--spacing-scale-2);
      padding: var(--spacing-scale-1) var(--spacing-scale-3);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
      flex-wrap: wrap;
    }
    .toolbar-group { display: flex; align-items: center; gap: var(--spacing-scale-1); }
    .toolbar-label { color: var(--colors-semantic-text-muted); font-size: 0.6rem; }
    .range-btn, .action-btn {
      padding: 1px 6px; border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-scale-sm); background: transparent;
      color: var(--colors-semantic-text-secondary); cursor: pointer;
      font-family: inherit; font-size: inherit;
      transition: var(--transitions-fast);
    }
    .range-btn:hover, .action-btn:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-text-primary); }
    .range-btn.active { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); background: var(--colors-semantic-accent-primary-subtle); }

    /* Metric toggles */
    .metric-toggle {
      display: flex; align-items: center; gap: 3px; padding: 1px 6px;
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-scale-sm); background: transparent;
      cursor: pointer; font-family: inherit; font-size: inherit;
      transition: var(--transitions-fast); white-space: nowrap;
    }
    .metric-toggle .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
    .metric-toggle.on { color: var(--colors-semantic-text-primary); }
    .metric-toggle.off { opacity: 0.35; }

    /* Hover tooltip */
    .hover-tooltip {
      position: absolute; pointer-events: none;
      background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-default);
      border-radius: var(--borderRadius-component-panel);
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
      color: var(--colors-semantic-text-primary);
      z-index: var(--zIndex-layers-tooltip);
      box-shadow: var(--shadows-tooltip);
      white-space: nowrap;
      transform: translate(-50%, -100%);
      margin-top: -8px;
    }

    /* Export menu */
    .export-menu {
      position: absolute; top: 100%; right: 0;
      background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-default);
      border-radius: var(--borderRadius-component-panel);
      padding: var(--spacing-scale-1);
      z-index: var(--zIndex-layers-dropdown);
      box-shadow: var(--shadows-panel);
      min-width: 120px;
    }
    .export-item {
      display: block; width: 100%; text-align: left;
      padding: var(--spacing-scale-2) var(--spacing-scale-3);
      border: none; background: transparent;
      color: var(--colors-semantic-text-primary);
      cursor: pointer; font-family: inherit; font-size: inherit;
      border-radius: var(--borderRadius-component-input);
    }
    .export-item:hover { background: var(--colors-semantic-bg-panel-hover); }
    .sep { width: 1px; height: 14px; background: var(--colors-semantic-border-subtle); }
  `;
  @state() private range: TelemetryRange = '5m';
  @state() private visibleMetrics = new Set<string>(DEFAULT_TELEMETRY_METRICS);
  @state() private hoverValue: { x: number; id: FieldId; value: number } | null = null;
  @state() private showExportMenu = false;

  private readonly chartListeners = new Set<() => void>();
  private readonly chartSource: ViewSource = {
    get: () => this.seriesDataset(),
    subscribe: (fn) => {
      this.chartListeners.add(fn);
      return () => this.chartListeners.delete(fn);
    },
  };
  private readonly spec: ViewSpec = {
    id: 'telemetry',
    title: 'Telemetry',
    shapes: ['series', 'table'],
    source: this.chartSource,
  };

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($telemetry, () => this.refreshChart());
    this.watch($cognitiveMetrics);
    mountTestApi('telemetry', {
      getData: () => $telemetry.get(),
      getSeries: () => this.getSeries(),
      getRange: () => this.range,
      setRange: (r: TelemetryRange) => this.setRange(r),
    });
  }

  override render() {
    const tooltip = this.hoverValue;
    const cognitive = $cognitiveMetrics.get();

    return html`
      <div class="toolbar">
        <span class="toolbar-label">Range</span>
        <div class="toolbar-group">
          ${TELEMETRY_RANGES.map(
            (r) => html`
            <button class="range-btn ${classMap({ active: this.range === r })}" @click=${() => this.setRange(r)}>${r}</button>
          `
          )}
        </div>

        <div class="sep"></div>

        <span class="toolbar-label">Metrics</span>
        <div class="toolbar-group">
          ${TELEMETRY_FIELDS.map((id) => {
            const d = fieldMeta(id);
            return html`
              <button class="metric-toggle ${this.visibleMetrics.has(fieldKey(id)) ? 'on' : 'off'}" @click=${() => this.toggleMetric(fieldKey(id))}>
                <span class="dot" style="background:${theme.colors[d.color ?? 'info']}"></span>
                ${d.short ?? d.label}
              </button>
            `;
          })}
        </div>

        <div class="sep"></div>

        <div class="toolbar-group" style="position:relative">
          <button class="action-btn" @click=${() => (this.showExportMenu = !this.showExportMenu)}>
            Export ▾
          </button>
          ${
            this.showExportMenu
              ? html`
            <div class="export-menu">
              <button class="export-item" @click=${this.exportCSV}>Export CSV</button>
              <button class="export-item" @click=${this.exportJSON}>Export JSON</button>
            </div>
          `
              : ''
          }
        </div>
      </div>

      <div class="telemetry-body"
        @mousemove=${this.handleChartMove}
        @mouseleave=${this.handleChartLeave}>
        <s-view class="chart-view" budget="full" .spec=${this.spec}></s-view>

        ${
          tooltip
            ? html`
          <div class="hover-tooltip" style="left:${tooltip.x}px;top:110px">
            ${fieldMeta(tooltip.id).label}: ${formatField(tooltip.id, tooltip.value)}
          </div>
        `
            : ''
        }

        ${
          cognitive
            ? html`
          <cognitive-metrics></cognitive-metrics>
        `
            : ''
        }
      </div>
    `;
  }

  private getSeries(): SeriesDatum[] {
    return telemetrySeries($telemetry.get(), this.visibleMetrics, this.range);
  }

  private seriesDataset(): SeriesDataset {
    return { kind: 'series', series: this.getSeries() };
  }

  private refreshChart() {
    for (const notify of this.chartListeners) notify();
  }

  private handleChartMove(e: MouseEvent) {
    const wrapper = e.currentTarget as HTMLElement | null;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    for (const { id, values } of this.getSeries()) {
      if (values.length < 2) continue;
      const step = rect.width / Math.max(values.length - 1, 1);
      const index = Math.round(x / step);
      if (index >= 0 && index < values.length) {
        this.hoverValue = { x, id: id as FieldId, value: values[index]! };
        break;
      }
    }
  }

  private handleChartLeave() {
    this.hoverValue = null;
  }

  private toggleMetric(key: string) {
    const next = new Set(this.visibleMetrics);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.visibleMetrics = next;
    this.refreshChart();
  }

  private setRange(range: TelemetryRange) {
    this.range = range;
    this.refreshChart();
  }

  private exportCSV() {
    const data = $telemetry.get();
    const points = TELEMETRY_RANGE_POINTS[this.range];
    const len = Math.min(
      ...TELEMETRY_METRIC_KEYS.map((k) => (data[k as keyof typeof data] as number[]).length),
      points
    );
    const start = data.reasoning_hz.length - len;
    let csv = 'index,' + TELEMETRY_METRIC_KEYS.join(',') + '\n';
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      csv += `${i},${TELEMETRY_METRIC_KEYS.map((k) => (data[k as keyof typeof data] as number[])?.[idx] ?? '').join(',')}\n`;
    }
    this.downloadFile(csv, 'telemetry.csv', 'text/csv');
    this.showExportMenu = false;
  }

  private exportJSON() {
    const data = $telemetry.get();
    const points = TELEMETRY_RANGE_POINTS[this.range];
    const sliced: Record<string, number[]> = {};
    for (const k of TELEMETRY_METRIC_KEYS) {
      const arr = data[k as keyof typeof data] as number[];
      sliced[k] = arr.length > points ? arr.slice(-points) : [...arr];
    }
    this.downloadFile(JSON.stringify(sliced, null, 2), 'telemetry.json', 'application/json');
    this.showExportMenu = false;
  }

  private downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'telemetry-panel': TelemetryPanel;
  }
}