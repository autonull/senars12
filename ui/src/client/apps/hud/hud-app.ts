/**
 * HUD — the original cognitive HUD, demoted to an app (P7).
 *
 * The full-featured workspace with graph, panels, chat, lenses, and renderers.
 * Kept for power users but not the default entry point.
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  $activeLens,
  $connectionState,
  $graphLayer,
  $workspaceGraph,
  BaseComponent,
  narsBackend,
  send,
} from '../../kernel/index.js';
import { defineApp, type AppDescriptor } from '../../framework/app.js';
import { defineBundle } from '../../framework/bundle.js';
import { type SurfaceDescriptor } from '../../framework/surface.js';
import { LENS_FACETS } from '../../utils/lens-catalog.js';
import { GRAPH_LAYER_FACETS } from '../../core/graph-layer-defs.js';
import { FILTER_FACETS } from '../../core/filter-facets.js';
import { PANEL_DEFS, panelSurfaces } from '../../core/panel-defs.js';
import { RENDERER_DEFS, rendererSurfaces } from '../../core/renderer-defs.js';
import { projectWorkspaceGraph } from '../../kernel/domain.js';
import { $selectedNodeIds, $viewSelection, setWorkspaceFocus, setWorkspaceSelection } from '../../core/store.js';
import { eventBus } from '../../core/events.js';

/** The HUD app surface — mounted in the viewport. */
@customElement('hud-surface')
export class HudSurface extends BaseComponent {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--colors-semantic-bg-base);
      color: var(--colors-semantic-text-primary);
      font-family: var(--typography-fontFamilies-ui, system-ui, sans-serif);
    }
    .app {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    header {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2, 8px);
      padding: 12px 24px;
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      background: var(--colors-semantic-bg-panel-solid);
    }
    .wordmark {
      font-weight: 650;
      letter-spacing: 0.02em;
    }
    .tagline {
      font-size: 13px;
      color: var(--colors-semantic-text-muted);
    }
    .toolbar {
      display: flex;
      gap: 8px;
      margin-left: auto;
      flex-wrap: wrap;
    }
    .toolbar-group {
      display: flex;
      gap: 4px;
      padding: 0 8px;
      border-left: 1px solid var(--colors-semantic-border-subtle);
    }
    select {
      background: var(--colors-semantic-bg-base);
      color: var(--colors-semantic-text-primary);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }
    select:focus {
      border-color: var(--colors-semantic-accent-primary, #6ea8fe);
    }
    .renderer-switch {
      display: flex;
      gap: 4px;
    }
    .renderer-switch button {
      background: var(--colors-semantic-bg-base);
      color: var(--colors-semantic-text-primary);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
    }
    .renderer-switch button.active {
      background: var(--colors-semantic-accent-primary, #6ea8fe);
      color: #0b1020;
      border-color: var(--colors-semantic-accent-primary, #6ea8fe);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--colors-semantic-text-muted);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--colors-semantic-text-muted);
    }
    .dot.connected {
      background: #46c07a;
    }
    .dot.disconnected {
      background: #e5534b;
    }
    .viewport {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    .graph-container {
      width: 100%;
      height: 100%;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--colors-semantic-text-muted);
      text-align: center;
      padding: 24px;
    }
    .empty h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--colors-semantic-text-primary);
      margin: 0 0 8px;
    }
    .stats {
      display: flex;
      gap: 24px;
      margin-top: 16px;
      font-size: 14px;
    }
    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--colors-semantic-accent-primary, #6ea8fe);
    }
    .stat-label {
      font-size: 12px;
      color: var(--colors-semantic-text-muted);
    }
  `;

  @state() private activeLens = 'belief';
  @state() private activeGraphLayer = 'both';
  @state() private activeFilter = 'all';
  @state() private activeRenderer = '2d';
  @state() private projection = { nodes: new Map(), edges: new Map() };

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($activeLens);
    this.watch($graphLayer);
    this.watchWith($workspaceGraph, () => this.updateProjection());
    this.activeLens = $activeLens.get();
    this.activeGraphLayer = $graphLayer.get();
  }

  private updateProjection(): void {
    const graph = $workspaceGraph.get();
    this.projection = projectWorkspaceGraph(graph);
    this.requestUpdate();
  }

  private renderGraphStats(): TemplateResult {
    const nodeCount = this.projection.nodes.size;
    const edgeCount = this.projection.edges.size;
    return html`
      <div class="stats">
        <div class="stat">
          <span class="stat-value">${nodeCount}</span>
          <span class="stat-label">Nodes</span>
        </div>
        <div class="stat">
          <span class="stat-value">${edgeCount}</span>
          <span class="stat-label">Edges</span>
        </div>
      </div>
    `;
  }

  private renderToolbar(): TemplateResult {
    const lensOptions = LENS_FACETS.ids.map((id) => {
      const facet = LENS_FACETS.get(id);
      return html`<option value=${id} ?selected=${this.activeLens === id}>${facet!.label}</option>`;
    });

    const layerOptions = GRAPH_LAYER_FACETS.ids.map((id) => {
      const facet = GRAPH_LAYER_FACETS.get(id);
      return html`<option value=${id} ?selected=${this.activeGraphLayer === id}>${facet!.label}</option>`;
    });

    const filterOptions = FILTER_FACETS.ids.map((id) => {
      const facet = FILTER_FACETS.get(id);
      return html`<option value=${id} ?selected=${this.activeFilter === id}>${facet!.label}</option>`;
    });

    const rendererOptions = RENDERER_DEFS.ids.map((id) => {
      const def = RENDERER_DEFS.get(id);
      return html`
        <button
          class=${this.activeRenderer === id ? 'active' : ''}
          @click=${() => {
            this.activeRenderer = id;
            this.requestUpdate();
          }}
        >
          ${def.label}
        </button>
      `;
    });

    return html`
      <div class="toolbar">
        <div class="toolbar-group">
          <select
            @change=${(e: Event) => (this.activeLens = (e.target as HTMLSelectElement).value)}
            .value=${this.activeLens}
            aria-label="Lens"
          >
            ${lensOptions}
          </select>
        </div>
        <div class="toolbar-group">
          <select
            @change=${(e: Event) => (this.activeGraphLayer = (e.target as HTMLSelectElement).value)}
            .value=${this.activeGraphLayer}
            aria-label="Graph Layer"
          >
            ${layerOptions}
          </select>
        </div>
        <div class="toolbar-group">
          <select
            @change=${(e: Event) => (this.activeFilter = (e.target as HTMLSelectElement).value)}
            .value=${this.activeFilter}
            aria-label="Filter"
          >
            ${filterOptions}
          </select>
        </div>
        <div class="toolbar-group renderer-switch">
          ${rendererOptions}
        </div>
      </div>
    `;
  }

  protected override render(): TemplateResult {
    const status = $connectionState.get();
    const hasGraph = this.projection.nodes.size > 0 || this.projection.edges.size > 0;

    return html`
      <div class="app">
        <header>
          <span class="wordmark">SeNARS</span>
          <span class="tagline">HUD — cognitive workspace</span>
          ${this.renderToolbar()}
          <span class="status">
            <span class="dot ${status}"></span>${status}
          </span>
        </header>
        <div class="viewport">
          <div class="graph-container">
            ${hasGraph
              ? this.renderGraphStats()
              : html`
                  <div class="empty">
                    <h2>No graph data</h2>
                    <p>Connect to a backend to see the concept graph.</p>
                    <p>Use Ask to add beliefs and goals.</p>
                  </div>
                `}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hud-surface': HudSurface;
  }
}

/** HUD app surfaces — viewport with panels. */
const hudSurfaces: SurfaceDescriptor[] = [
  {
    id: 'hud-surface',
    label: 'HUD',
    title: 'Cognitive HUD',
    icon: 'dashboard',
    placement: 'viewport',
    tag: 'hud-surface',
  },
  // Panels
  ...panelSurfaces(),
];

/** HUD app descriptor — one bundle of contributions plus the shell contract. */
export const HUD_APP: AppDescriptor<'hud'> = defineApp({
  bundle: defineBundle({
    id: 'hud',
    name: 'HUD',
    description: 'Full cognitive workspace — graph, panels, chat, lenses, renderers.',
    surfaces: {
      viewport: hudSurfaces.filter((s) => s.placement === 'viewport'),
      panel: hudSurfaces.filter((s) => s.placement === 'panel'),
    },
  }),
  icon: 'dashboard',
  defaultLens: 'belief',
  defaultGraphLayer: 'both',
  defaultCapabilityFilter: 'all',
  connection: {
    url: '/ws',
    reconnect: true,
  },
  capability: 'language',
});

/** The HUD app id for registration and routing. */
export const HUD_APP_ID = HUD_APP.id;