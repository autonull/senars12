import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  $activeLens,
  $graphLayer,
  $graphShape,
  $viewportMode,
  $workspaceGraph,
  BaseComponent,
  projectWorkspaceGraph,
} from '../../kernel/index.js';
import { defineApp, type AppDescriptor } from '../../framework/app.js';
import { defineBundle } from '../../framework/bundle.js';
import type { Composition } from '../../framework/composition.js';
import { type SurfaceDescriptor } from '../../framework/surface.js';
import '../../components/graph-viewport.js';

/** The Explore app surface — mounted in the viewport. */
@customElement('explore-surface')
export class ExploreSurface extends BaseComponent {
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
    const graphShape = $graphShape.get();
    const viewportMode = $viewportMode.get();
    const lens = $activeLens.get();
    const layer = $graphLayer.get();

    return html`
      <div class="app">
        <div class="viewport">
          <div class="graph-container">
            ${hasGraph
              ? html`
                  <graph-viewport
                    style="width:100%;height:100%"
                    .filter=${{ mode: lens, layer, shape: graphShape }}
                    .mode=${viewportMode}
                  ></graph-viewport>
                  ${this.renderGraphStats()}
                `
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
    'explore-surface': ExploreSurface;
  }
}

/** Explore app surfaces — viewport + optional panels. */
const exploreSurfaces: SurfaceDescriptor[] = [
  {
    id: 'explore-surface',
    label: 'Explore',
    title: 'Graph Explorer',
    icon: 'graph',
    placement: 'viewport',
    tag: 'explore-surface',
  },
];

/** Explore's default composition — one graph-bearing cell; the shell supplies the chrome. */
const exploreComposition: Composition = {
  id: 'explore',
  name: 'Explore',
  layout: 'auto',
  cells: [{ surface: 'explore-surface' }],
  globals: {
    lens: 'belief',
    layer: 'both',
    shape: 'graph',
    mode: '2d',
    fit: 'legible',
    filter: 'all',
  },
};

/** Explore app descriptor — one bundle of contributions plus the shell contract. */
export const EXPLORE_APP: AppDescriptor<'explore'> = defineApp({
  bundle: defineBundle({
    id: 'explore',
    name: 'Explore',
    description: 'Graph exploration — lenses, layers, and filters over the concept graph.',
    surfaces: {
      viewport: exploreSurfaces,
    },
  }),
  icon: 'graph',
  composition: exploreComposition,
  defaultLens: 'belief',
  defaultGraphLayer: 'both',
  defaultCapabilityFilter: 'all',
  connection: {
    url: '/ws',
    reconnect: true,
  },
  capability: 'language',
});

/** The Explore app id for registration and routing. */
export const EXPLORE_APP_ID = EXPLORE_APP.id;