import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $telemetry } from '../core/store.js';

@customElement('telemetry-panel')
export class TelemetryPanel extends LitElement {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId = 0;
  private unsub = $telemetry.subscribe(() => this.scheduleDraw());

  static override styles = css`
    :host { display: block; background: var(--bg-panel); border-top: 1px solid var(--border-dim); position: relative; }
    canvas { display: block; width: 100%; height: 120px; }
    .labels { position: absolute; top: 4px; left: 8px; font-family: var(--font-data); font-size: 0.6rem; pointer-events: none; }
    .labels span { margin-right: 12px; }
    .hz { color: var(--accent-amber); }
    .tps { color: var(--accent-cyan); }
    .mem { color: var(--accent-magenta); }
  `;

  override disconnectedCallback() {
    this.unsub();
    cancelAnimationFrame(this.rafId);
    super.disconnectedCallback();
  }

  private scheduleDraw() {
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => this.draw());
  }

  override firstUpdated() {
    this.canvas = this.shadowRoot?.getElementById('telemetry-canvas') as HTMLCanvasElement;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.draw();
  }

  private draw() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.getBoundingClientRect();
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = 120 * devicePixelRatio;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = '120px';
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
    const w = rect.width;
    const h = 120;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const data = $telemetry.get();
    const series = [
      { label: 'hz', color: '#ffb000', values: data.reasoning_hz },
      { label: 'tps', color: '#00f3ff', values: data.tokens_per_sec },
      { label: 'mem', color: '#ff0055', values: data.memory_mb },
    ];

    for (const s of series) {
      if (s.values.length < 2) continue;
      const max = Math.max(...s.values, 1);
      const step = w / Math.max(s.values.length - 1, 1);

      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < s.values.length; i++) {
        const x = i * step;
        const y = h - (s.values[i]! / max) * (h - 8) - 4;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.font = '9px JetBrains Mono, monospace';
    const latest = series.map(s => ({ label: s.label, value: s.values.at(-1) ?? 0 }));
    latest.forEach((l, i) => {
      ctx.fillText(`${l.label} ${l.value.toFixed(1)}`, 4, 10 + i * 12);
    });
  }

  override render() {
    return html`
      <canvas id="telemetry-canvas"></canvas>
    `;
  }
}
