import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $activeLens, BaseComponent, eventBus } from '../core/index.js';
import { LENS_CATALOG, type LensDescriptor } from '../utils/lens-catalog.js';
import { theme } from '../utils/theme.js';
import type { BuiltinLens, ModulationSpec } from '../../shared/lens-schema.js';

@customElement('graph-legend')
export class GraphLegend extends BaseComponent {
  static override styles = css`
    :host {
      display: block;
      position: absolute;
      bottom: 12px;
      right: 12px;
      z-index: var(--zIndex-layers-popover);
    }
    .legend {
      background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-default);
      border-radius: var(--borderRadius-component-panel);
      padding: var(--spacing-scale-3);
      font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      max-width: 220px;
    }
    .legend-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-scale-2);
      padding-bottom: var(--spacing-scale-2);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
    }
    .legend-title {
      font-weight: var(--typography-fontWeights-semibold);
      color: var(--colors-semantic-text-primary);
    }
    .legend-close {
      background: none;
      border: none;
      color: var(--colors-semantic-text-muted);
      cursor: pointer;
      padding: 0;
      font-size: var(--typography-scale-lg);
      line-height: 1;
    }
    .legend-close:hover {
      color: var(--colors-semantic-text-primary);
    }
    .legend-row {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      margin: var(--spacing-scale-1) 0;
    }
    .legend-swatch {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 1px solid var(--colors-semantic-border-subtle);
      flex-shrink: 0;
    }
    .legend-swatch.rect {
      border-radius: 3px;
    }
    .legend-label {
      color: var(--colors-semantic-text-secondary);
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .legend-scale {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      margin-top: var(--spacing-scale-2);
      height: 16px;
    }
    .legend-gradient {
      flex: 1;
      height: 100%;
      border-radius: var(--borderRadius-component-input);
      border: 1px solid var(--colors-semantic-border-subtle);
    }
    .legend-scale-labels {
      display: flex;
      justify-content: space-between;
      width: 100%;
      margin-top: 2px;
      font-size: 10px;
      color: var(--colors-semantic-text-muted);
    }
    .legend-divider {
      height: 1px;
      background: var(--colors-semantic-border-subtle);
      margin: var(--spacing-scale-2) 0;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($activeLens);
  }

  override render() {
    const lensId = $activeLens.get() as BuiltinLens;
    const lens = LENS_CATALOG[lensId];

    if (!lens) return html``;

    return html`
      <div class="legend">
        <div class="legend-header">
          <span class="legend-title">Legend: ${lens.label}</span>
          <button class="legend-close" @click=${() => eventBus.emit('graph:legend-toggle')} aria-label="Close legend">×</button>
        </div>

        ${this.renderLegendContent(lens)}
      </div>
    `;
  }

  private renderLegendContent(lens: LensDescriptor) {
    const spec = lens.spec;
    const modulation = spec.modulation;
    const children = this.getModulationChildren(modulation);

    if (!children || children.length === 0) return html``;

    const rows: any[] = [];

    for (const child of children) {
      if (child.op === 'channel') {
        const grandChild = child.child;
        if (grandChild.op === 'field') {
          const channel = child.channel;
          const field = grandChild.field;
          const map = grandChild.map;

          if (channel === 'color' && field === 'truth' && map === 'truth-to-color') {
            rows.push(this.renderTruthColorScale());
          } else if (channel === 'opacity' && field === 'confidence' && map === 'confidence-to-opacity') {
            rows.push(this.renderConfidenceOpacityScale());
          } else if (channel === 'size' && field === 'priority' && map === 'priority-to-size') {
            rows.push(this.renderPrioritySizeScale());
          } else if (channel === 'color' && field === 'truth' && !map) {
            const label = 'Truth (belief lens)';
            rows.push(html`
              <div class="legend-row">
                <div class="legend-swatch" style="background:${theme.colors.accentCyan}"></div>
                <span class="legend-label">${label}</span>
              </div>`);
          }
        } else if (grandChild.op === 'const') {
          const channel = child.channel;
          if (channel === 'color') {
            const color = grandChild.value;
            const label = `${lens.label} (fixed)`;
            rows.push(html`
              <div class="legend-row">
                <div class="legend-swatch" style="background:${color}"></div>
                <span class="legend-label">${label}</span>
              </div>`);
          } else if (channel === 'size') {
            const size = grandChild.value;
            const style = `background:${theme.colors.accentCyan};width:${size}px;height:${size}px`;
            rows.push(html`
              <div class="legend-row">
                <div class="legend-swatch rect" style=${style}></div>
                <span class="legend-label">Size: ${size}px</span>
              </div>`);
          }
        }
      } else if (child.op === 'when' && child.child.op === 'channel') {
        const predicate = child.predicate;
        const whenChannel = child.child.channel;
        const whenChild = child.child.child;

        if (predicate === 'isContradiction' && whenChannel === 'color' && whenChild.op === 'const') {
          const color = whenChild.value;
          rows.push(html`
            <div class="legend-row">
              <div class="legend-swatch" style="background:${color}"></div>
              <span class="legend-label">Contradiction</span>
            </div>`);
        }
      }
    }

    if (rows.length === 0) return html``;

    return html`
      ${rows.map((row, i) => html`${i > 0 ? html`<div class="legend-divider"></div>` : ''}${row}`)}
    `;
  }

  private getModulationChildren(mod: ModulationSpec): ModulationSpec[] {
    if (mod.op === 'union') {
      return mod.children;
    }
    return [mod];
  }

  private renderTruthColorScale() {
    // truth-to-color: f=0 (red) to f=1 (green) via HSL 0-120
    return html`
      <div class="legend-row">
        <div class="legend-swatch" style="background:hsl(0, 70%, 50%)"></div>
        <span class="legend-label">Frequency (f)</span>
      </div>
      <div class="legend-scale">
        <div class="legend-gradient" style="background:linear-gradient(90deg, hsl(0,70%,50%), hsl(120,70%,50%))"></div>
      </div>
      <div class="legend-scale-labels">
        <span>Low (0.0)</span>
        <span>High (1.0)</span>
      </div>
    `;
  }

  private renderConfidenceOpacityScale() {
    const gradient = `linear-gradient(90deg, ${theme.colors.accentCyan}33, ${theme.colors.accentCyan})`;
    return html`
      <div class="legend-row">
        <div class="legend-swatch" style="background:${theme.colors.accentCyan};opacity:0.3"></div>
        <span class="legend-label">Confidence (c) → Opacity</span>
      </div>
      <div class="legend-scale">
        <div class="legend-gradient" style="background:${gradient}"></div>
      </div>
      <div class="legend-scale-labels">
        <span>Low (0.3)</span>
        <span>High (1.0)</span>
      </div>
    `;
  }

  private renderPrioritySizeScale() {
    const gradient = `linear-gradient(90deg, ${theme.colors.accentCyan}33, ${theme.colors.accentCyan})`;
    const swatchStyle = `background:${theme.colors.accentCyan};width:10px;height:10px`;
    return html`
      <div class="legend-row">
        <div class="legend-swatch rect" style=${swatchStyle}></div>
        <span class="legend-label">Priority → Size</span>
      </div>
      <div class="legend-scale">
        <div class="legend-gradient" style="background:${gradient}"></div>
      </div>
      <div class="legend-scale-labels">
        <span>Low (10px)</span>
        <span>High (60px)</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'graph-legend': GraphLegend;
  }
}