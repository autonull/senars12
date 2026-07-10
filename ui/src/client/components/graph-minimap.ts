import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { $graphEdges, $graphNodes, $viewport, BaseComponent, eventBus } from '../core/index.js';
import { TOKEN_COLORS, cssToken } from '../utils/token-colors.js';

const MINIMAP_SIZE = 160;
const PADDING = 10;

@customElement('graph-minimap')
export class GraphMinimap extends BaseComponent {
  static override styles = css`
    :host { display: block; position: absolute; bottom: var(--spacing-scale-3); right: var(--spacing-scale-3); z-index: var(--zIndex-layers-popover); }
    .minimap-container { position: relative; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-default); border-radius: var(--borderRadius-component-panel); box-shadow: 0 4px 12px rgba(0,0,0,0.3); overflow: hidden; }
    .minimap-toggle { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-button); color: var(--colors-semantic-text-muted); cursor: pointer; font-size: 0.7rem; transition: var(--transitions-fast); }
    .minimap-toggle:hover { color: var(--colors-semantic-accent-primary); border-color: var(--colors-semantic-accent-primary); }
    canvas { display: block; cursor: crosshair; }
  `;
  @state() private visible = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($graphNodes, () => this.scheduleDraw());
    this.watchWith($graphEdges, () => this.scheduleDraw());
    this.watchWith($viewport, () => this.scheduleDraw());
    eventBus.on('graph:minimap-toggle', () => {
      this.visible = !this.visible;
      this.scheduleDraw();
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    eventBus.off('graph:minimap-toggle', () => {});
  }

  override firstUpdated() {
    this.canvas = this.shadowRoot?.getElementById('minimap-canvas') as HTMLCanvasElement;
    if (this.canvas) this.ctx = this.canvas.getContext('2d');
  }

  override render() {
    return html`
      ${
        this.visible
          ? html`
        <div class="minimap-container">
          <canvas id="minimap-canvas" width=${MINIMAP_SIZE} height=${MINIMAP_SIZE} @click=${this.handleClick}></canvas>
        </div>
      `
          : html`
        <button class="minimap-toggle" @click=${() => {
          this.visible = true;
          this.scheduleDraw();
        }} title="Show minimap">🗺</button>
      `
      }
    `;
  }

  private scheduleDraw() {
    if (!this.visible) return;
    requestAnimationFrame(() => this.draw());
  }

  private draw() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = MINIMAP_SIZE;
    const h = MINIMAP_SIZE;

    this.canvas.width = w;
    this.canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = cssToken('--colors-semantic-bg-base', '#0a0a0a');
    ctx.fillRect(0, 0, w, h);

    const nodes = $graphNodes.get();
    const edges = $graphEdges.get();
    if (nodes.size === 0) return;

// Compute bounds
     let minX = Number.POSITIVE_INFINITY;
     let minY = Number.POSITIVE_INFINITY;
     let maxX = Number.NEGATIVE_INFINITY;
     let maxY = Number.NEGATIVE_INFINITY;
    const positions = new Map<string, { x: number; y: number }>();

    // Parse positions from graph data or edges
    for (const [id, nd] of nodes) {
      const x = nd.layout?.x ?? Math.random() * 400 - 200;
      const y = nd.layout?.y ?? Math.random() * 400 - 200;
      positions.set(id, { x, y });
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }

    const rangeX = Math.max(maxX - minX, 1);
    const rangeY = Math.max(maxY - minY, 1);
    const scale = Math.min((w - PADDING * 2) / rangeX, (h - PADDING * 2) / rangeY);

    const px = (x: number) => PADDING + (x - minX) * scale;
    const py = (y: number) => PADDING + (y - minY) * scale;

    // Draw edges
    ctx.strokeStyle = cssToken('--colors-semantic-border-subtle', TOKEN_COLORS.borderDim);
    ctx.lineWidth = 0.5;
    for (const [, ed] of edges) {
      const src = positions.get(ed.source);
      const tgt = positions.get(ed.target);
      if (src && tgt) {
        ctx.beginPath();
        ctx.moveTo(px(src.x), py(src.y));
        ctx.lineTo(px(tgt.x), py(tgt.y));
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const [id, nd] of nodes) {
      const pos = positions.get(id);
      if (!pos) continue;
      const cx = px(pos.x);
      const cy = py(pos.y);
      const r = Math.max(2, (10 + 30 * (nd.priority ?? 0.5)) * scale * 0.5);
      ctx.fillStyle = nd.isContradiction ? '#ffaa00' : TOKEN_COLORS.accentCyan;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw viewport rectangle
    const vp = $viewport.get();
    const vpW = (w - PADDING * 2) / (rangeX / vp.zoom);
    const vpH = (h - PADDING * 2) / (rangeY / vp.zoom);
    const vpX = px(vp.x - rangeX / (2 * vp.zoom));
    const vpY = py(vp.y - rangeY / (2 * vp.zoom));

    ctx.strokeStyle = TOKEN_COLORS.accentCyan;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(vpX, vpY, vpW, vpH);
    ctx.setLineDash([]);
  }

  private handleClick(e: MouseEvent) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

// Convert minimap coords back to graph coords
     const nodes = $graphNodes.get();
     let minX = Number.POSITIVE_INFINITY;
     let minY = Number.POSITIVE_INFINITY;
     let maxX = Number.NEGATIVE_INFINITY;
     let maxY = Number.NEGATIVE_INFINITY;
    for (const [, nd] of nodes) {
      const px = nd.layout?.x ?? 0;
      const py = nd.layout?.y ?? 0;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    const rangeX = Math.max(maxX - minX, 1);
    const rangeY = Math.max(maxY - minY, 1);
    const scale = Math.min(
      (MINIMAP_SIZE - PADDING * 2) / rangeX,
      (MINIMAP_SIZE - PADDING * 2) / rangeY
    );

    const graphX = minX + (x - PADDING) / scale;
    const graphY = minY + (y - PADDING) / scale;

    eventBus.emit('graph:pan-to', { x: graphX, y: graphY });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'graph-minimap': GraphMinimap;
  }
}
