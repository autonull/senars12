import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { $telemetry, $cognitiveMetrics, mountTestApi } from '../core/index.js';
import { BaseComponent } from '../core/index.js';
import { TOKEN_COLORS, cssToken } from '../utils/token-colors.js';

interface TelemetrySeries { key: string; values: number[]; color: string; label: string; unit: string }
type TimeRange = '1m' | '5m' | '15m' | '1h';
const RANGE_POINTS: Record<TimeRange, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600 };
const ALL_METRICS = ['reasoning_hz', 'tokens_per_sec', 'memory_mb', 'ws_latency_ms'] as const;

@customElement('telemetry-panel')
export class TelemetryPanel extends BaseComponent {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId = 0;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;

  @state() private range: TimeRange = '5m';
  @state() private visibleMetrics = new Set<string>(['reasoning_hz', 'tokens_per_sec', 'memory_mb']);
  @state() private hoverValue: { x: number; label: string; value: number; unit: string } | null = null;
  @state() private fullscreen = false;
  @state() private showExportMenu = false;

  static override styles = css`
    :host {
      display: block; background: var(--colors-semantic-bg-panel);
      border-top: 1px solid var(--colors-semantic-border-subtle);
      position: relative; container-type: inline-size;
    }
    .telemetry-body { position: relative; }
    canvas { display: block; width: 100%; height: 120px; cursor: crosshair; }
    .fullscreen canvas { height: 60vh; max-height: 500px; }

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
    .range-btn {
      padding: 1px 6px; border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-scale-sm); background: transparent;
      color: var(--colors-semantic-text-secondary); cursor: pointer;
      font-family: inherit; font-size: inherit;
      transition: var(--transitions-fast);
    }
    .range-btn:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-text-primary); }
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

    /* Buttons */
    .action-btn {
      padding: 1px 6px; border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-scale-sm); background: transparent;
      color: var(--colors-semantic-text-secondary); cursor: pointer;
      font-family: inherit; font-size: inherit;
      transition: var(--transitions-fast);
    }
    .action-btn:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-text-primary); }

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

    /* Fullscreen overlay */
    .fullscreen-overlay {
      position: fixed; inset: 0; z-index: var(--zIndex-layers-modal);
      background: var(--colors-semantic-bg-base);
      display: flex; flex-direction: column;
    }
    .fullscreen-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--spacing-scale-3) var(--spacing-scale-5);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
    }
    .fullscreen-title { font-family: var(--typography-fontFamilies-ui); font-weight: var(--typography-fontWeights-semibold); }
    .fullscreen-body { flex: 1; padding: var(--spacing-scale-4); display: flex; flex-direction: column; }
    .fullscreen-body canvas { flex: 1; height: auto; }

    /* Separator */
    .sep { width: 1px; height: 14px; background: var(--colors-semantic-border-subtle); }

    /* Legend labels */
    .legend {
      position: absolute; top: 4px; left: 8px;
      font-family: var(--typography-fontFamilies-data);
      font-size: 0.6rem; pointer-events: none;
      display: flex; flex-direction: column; gap: 1px;
    }
    .legend-row { display: flex; gap: var(--spacing-scale-2); }
    .legend-label { color: var(--colors-semantic-text-muted); }
    .legend-value { font-variant-numeric: tabular-nums; }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($telemetry, () => this.scheduleDraw());
    mountTestApi('telemetry', {
      getData: () => $telemetry.get(),
      getRange: () => this.range,
      setRange: (r: TimeRange) => { this.range = r; this.requestUpdate(); },
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.rafId);
  }

  private scheduleDraw() {
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => this.draw());
  }

  override firstUpdated() {
    this.canvas = this.shadowRoot?.getElementById('telemetry-canvas') as HTMLCanvasElement;
    if (this.canvas) this.ctx = this.canvas.getContext('2d');
    this.draw();
  }

  private getValues(key: string): number[] {
    const data = $telemetry.get();
    const values = data[key as keyof typeof data] as number[] | undefined;
    if (!values) return [];
    const points = RANGE_POINTS[this.range];
    return values.length > points ? values.slice(-points) : values;
  }

  private getSeries(): TelemetrySeries[] {
    const meta: Record<(typeof ALL_METRICS)[number], { label: string; color: string; unit: string }> = {
      reasoning_hz: { label: 'Hz', color: TOKEN_COLORS.warning, unit: 'Hz' },
      tokens_per_sec: { label: 'TPS', color: TOKEN_COLORS.accentCyan, unit: 'tps' },
      memory_mb: { label: 'Mem', color: TOKEN_COLORS.accentMagenta, unit: 'MB' },
      ws_latency_ms: { label: 'Lat', color: TOKEN_COLORS.info, unit: 'ms' },
    };
    return ALL_METRICS
      .filter((k) => this.visibleMetrics.has(k))
      .map((key) => {
        const m = meta[key];
        return {
          key,
          values: this.getValues(key),
          color: m.color,
          label: m.label,
          unit: m.unit,
        };
      });
  }

  private draw() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = devicePixelRatio;
    const h = this.fullscreen ? this.canvas.clientHeight || 300 : 120;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderChart(rect.width, h);
  }

  private renderChart(w: number, h: number) {
    const ctx = this.ctx!;
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 16, bottom: 4, left: 4, right: 4 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const series = this.getSeries();
    if (series.length === 0) return;

    // Draw grid lines
    ctx.strokeStyle = cssToken('--colors-semantic-border-subtle', TOKEN_COLORS.borderDim) + '4D';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    }

    // Draw each series
    for (const { values, color } of series) {
      if (values.length < 2) continue;
      const max = Math.max(...values, 1);
      const step = chartW / Math.max(values.length - 1, 1);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < values.length; i++) {
        const x = pad.left + i * step;
        const y = pad.top + chartH - (values[i]! / max) * chartH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw fill under line
      ctx.fillStyle = color + '1A';
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top + chartH);
      for (let i = 0; i < values.length; i++) {
        const x = pad.left + i * step;
        const y = pad.top + chartH - (values[i]! / max) * chartH;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(pad.left + (values.length - 1) * step, pad.top + chartH);
      ctx.closePath();
      ctx.fill();
    }
  }

  private handleCanvasMove(e: MouseEvent) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const series = this.getSeries();
    for (const { values, label, unit } of series) {
      if (values.length < 2) continue;
      const chartW = rect.width - 8;
      const step = chartW / Math.max(values.length - 1, 1);
      const idx = Math.round(x / step);
      if (idx >= 0 && idx < values.length) {
        this.hoverValue = { x: e.clientX - rect.left, label, value: values[idx]!, unit };
        break;
      }
    }
  }

  private handleCanvasLeave() {
    this.hoverValue = null;
  }

  private toggleMetric(key: string) {
    const next = new Set(this.visibleMetrics);
    if (next.has(key)) next.delete(key); else next.add(key);
    this.visibleMetrics = next;
    this.scheduleDraw();
  }

  private setRange(range: TimeRange) {
    this.range = range;
    this.scheduleDraw();
  }

  private toggleFullscreen() {
    this.fullscreen = !this.fullscreen;
    requestAnimationFrame(() => this.draw());
  }

  private exportCSV() {
    const data = $telemetry.get();
    const points = RANGE_POINTS[this.range];
    const len = Math.min(...ALL_METRICS.map((k) => (data[k] as number[]).length), points);
    const start = data.reasoning_hz.length - len;
    let csv = 'index,' + ALL_METRICS.join(',') + '\n';
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      csv += `${i},${ALL_METRICS.map((k) => (data[k as keyof typeof data] as number[])?.[idx] ?? '').join(',')}\n`;
    }
    this.downloadFile(csv, 'telemetry.csv', 'text/csv');
    this.showExportMenu = false;
  }

  private exportJSON() {
    const data = $telemetry.get();
    const points = RANGE_POINTS[this.range];
    const sliced: Record<string, number[]> = {};
    for (const k of ALL_METRICS) {
      const arr = data[k] as number[];
      sliced[k] = arr.length > points ? arr.slice(-points) : [...arr];
    }
    this.downloadFile(JSON.stringify(sliced, null, 2), 'telemetry.json', 'application/json');
    this.showExportMenu = false;
  }

  private downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  override render() {
    const tooltip = this.hoverValue;
    const cognitive = $cognitiveMetrics.get();

    const panel = html`
      <div class="toolbar">
        <span class="toolbar-label">Range</span>
        <div class="toolbar-group">
          ${(['1m', '5m', '15m', '1h'] as TimeRange[]).map((r) => html`
            <button class="range-btn ${classMap({ active: this.range === r })}" @click=${() => this.setRange(r)}>${r}</button>
          `)}
        </div>

        <div class="sep"></div>

        <span class="toolbar-label">Metrics</span>
        <div class="toolbar-group">
          ${ALL_METRICS.map((k) => {
            const m = (k === 'reasoning_hz' ? { label: 'Hz', color: TOKEN_COLORS.warning } :
                       k === 'tokens_per_sec' ? { label: 'TPS', color: TOKEN_COLORS.accentCyan } :
                       k === 'memory_mb' ? { label: 'Mem', color: TOKEN_COLORS.accentMagenta } :
                       { label: 'Lat', color: TOKEN_COLORS.info });
            return html`
              <button class="metric-toggle ${this.visibleMetrics.has(k) ? 'on' : 'off'}" @click=${() => this.toggleMetric(k)}>
                <span class="dot" style="background:${m.color}"></span>
                ${m.label}
              </button>
            `;
          })}
        </div>

        <div class="sep"></div>

        <div class="toolbar-group" style="position:relative">
          <button class="action-btn" @click=${() => this.showExportMenu = !this.showExportMenu}>
            Export ▾
          </button>
          ${this.showExportMenu ? html`
            <div class="export-menu">
              <button class="export-item" @click=${this.exportCSV}>Export CSV</button>
              <button class="export-item" @click=${this.exportJSON}>Export JSON</button>
            </div>
          ` : ''}
          <button class="action-btn" @click=${this.toggleFullscreen}>
            ${this.fullscreen ? 'Exit' : 'Fullscreen'}
          </button>
        </div>
      </div>

      <div class="telemetry-body">
        <canvas id="telemetry-canvas"
          @mousemove=${this.handleCanvasMove}
          @mouseleave=${this.handleCanvasLeave}>
        </canvas>

        ${tooltip ? html`
          <div class="hover-tooltip" style="left:${tooltip.x}px;top:110px">
            ${tooltip.label}: ${tooltip.value.toFixed(2)} ${tooltip.unit}
          </div>
        ` : ''}

        ${cognitive ? html`
          <cognitive-metrics></cognitive-metrics>
        ` : ''}
      </div>
    `;

    if (this.fullscreen) {
      return html`
        <div class="fullscreen-overlay">
          <div class="fullscreen-header">
            <span class="fullscreen-title">Telemetry — Fullscreen</span>
            <button class="action-btn" @click=${this.toggleFullscreen}>Close</button>
          </div>
          <div class="fullscreen-body">
            ${panel}
          </div>
        </div>
      `;
    }

    return panel;
  }
}
