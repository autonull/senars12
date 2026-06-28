import { html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $telemetry, mountTestApi } from '../core/store.js';
import { BaseComponent } from '../core/base-component.js';

interface TelemetrySeries { values: number[]; color: string; label: string }

@customElement('telemetry-panel')
export class TelemetryPanel extends BaseComponent {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId = 0;

  static override styles = css`
    :host { display: block; background: var(--bg-panel); border-top: 1px solid var(--border-dim); position: relative; }
    canvas { display: block; width: 100%; height: 120px; }
    .labels { position: absolute; top: 4px; left: 8px; font-family: var(--font-data); font-size: 0.6rem; pointer-events: none; }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($telemetry, () => this.scheduleDraw());
    mountTestApi('telemetry', { getData: () => $telemetry.get() });
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

  private draw() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.getBoundingClientRect();
    const dpr = devicePixelRatio;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = 120 * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = '120px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderChart(rect.width, 120);
  }

  private renderChart(w: number, h: number) {
    const ctx = this.ctx!;
    ctx.clearRect(0, 0, w, h);

    const { reasoning_hz, tokens_per_sec, memory_mb } = $telemetry.get();
    const series: TelemetrySeries[] = [
      { values: reasoning_hz, color: '#ffb000', label: 'hz' },
      { values: tokens_per_sec, color: '#00f3ff', label: 'tps' },
      { values: memory_mb, color: '#ff0055', label: 'mem' },
    ];

    for (const { values, color } of series) {
      if (values.length < 2) continue;
      const max = Math.max(...values, 1);
      const step = w / Math.max(values.length - 1, 1);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < values.length; i++) {
        const x = i * step;
        const y = h - (values[i]! / max) * (h - 8) - 4;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.font = '9px JetBrains Mono, monospace';
    const latest = series.map((s) => ({ label: s.label, value: s.values.at(-1) ?? 0 }));
    latest.forEach((l, i) => ctx.fillText(`${l.label} ${l.value.toFixed(1)}`, 4, 10 + i * 12));
  }

  override render() {
    return html`<canvas id="telemetry-canvas"></canvas>`;
  }
}