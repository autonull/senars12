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
  $graphLayer,
  $workspaceGraph,
  BaseComponent,
  narsBackend,
  send,
} from '../../kernel/index.js';
import { defineApp, type AppDescriptor } from '../../framework/app.js';
import { defineBundle } from '../../framework/bundle.js';
import type { Composition } from '../../framework/composition.js';
import { type SurfaceDescriptor } from '../../framework/surface.js';
import { PANEL_DEFS, panelSurfaces } from '../../core/panel-defs.js';
import { rendererSurfaces } from '../../core/renderer-defs.js';
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

  @state() private projection = { nodes: new Map(), edges: new Map() };

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($activeLens);
    this.watch($graphLayer);
    this.watchWith($workspaceGraph, () => this.updateProjection());
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

  protected override render(): TemplateResult {
    const hasGraph = this.projection.nodes.size > 0 || this.projection.edges.size > 0;

    return html`
      <div class="app">
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

/** HUD's default composition — one graph-bearing cell plus its panels. */
const hudComposition: Composition = {
  id: 'hud',
  name: 'HUD',
  layout: 'auto',
  cells: [{ surface: 'hud-surface' }],
  globals: {
    lens: 'belief',
    layer: 'both',
    shape: 'graph',
    mode: '2d',
    fit: 'legible',
    filter: 'all',
  },
};

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
  composition: hudComposition,
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