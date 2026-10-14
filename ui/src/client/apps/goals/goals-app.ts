/**
 * Goals — the goal management app.
 *
 * A focused surface for creating, tracking, and achieving goals.
 */
import { css, html, type TemplateResult } from 'lit';
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
import { projectWorkspaceGraph } from '../../kernel/domain.js';

/** The Goals app surface — mounted in the viewport. */
@customElement('goals-surface')
export class GoalsSurface extends BaseComponent {
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
    form {
      display: flex;
      gap: 8px;
      padding: 16px 24px;
      border-top: 1px solid var(--colors-semantic-border-subtle);
    }
    input {
      flex: 1;
      background: var(--colors-semantic-bg-panel-solid);
      color: var(--colors-semantic-text-primary);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }
    input:focus {
      border-color: var(--colors-semantic-accent-primary, #6ea8fe);
    }
    button {
      background: var(--colors-semantic-accent-primary, #6ea8fe);
      color: #0b1020;
      border: none;
      border-radius: 8px;
      padding: 0 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `;

  @state() private activeLens = 'goal';
  @state() private activeGraphLayer = 'both';
  @state() private activeFilter = 'all';
  @state() private draft = '';
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
    const projection = projectWorkspaceGraph($workspaceGraph.get());
    const goals = new Set(
      [...projection.nodes].filter(([, node]) => node.kind === 'goal').map(([id]) => id)
    );
    this.projection = {
      nodes: new Map([...projection.nodes].filter(([id]) => goals.has(id))),
      edges: new Map([...projection.edges].filter(([, edge]) => goals.has(edge.source) && goals.has(edge.target))),
    };
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
      </div>
    `;
  }

  private async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const text = this.draft.trim();
    if (!text) return;
    this.draft = '';
    const control = narsBackend.control;
    if (!control) return;
    await control.submit({ term: text, mode: 'goal' });
  }

  protected override render(): TemplateResult {
    const status = $connectionState.get();
    const hasGraph = this.projection.nodes.size > 0 || this.projection.edges.size > 0;

    return html`
      <div class="app">
        <header>
          <span class="wordmark">SeNARS</span>
          <span class="tagline">Goals — teleological workspace</span>
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
                    <h2>No goals yet</h2>
                    <p>Add a goal to start tracking.</p>
                  </div>
                `}
          </div>
        </div>
        <form @submit=${this.onSubmit}>
          <input
            .value=${this.draft}
            @input=${(e: Event) => (this.draft = (e.target as HTMLInputElement).value)}
            placeholder="Add a goal (ends with !)…"
            autocomplete="off"
          />
          <button type="submit" ?disabled=${!this.draft.trim()}>Add Goal</button>
        </form>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'goals-surface': GoalsSurface;
  }
}

/** Goals app surfaces — viewport surface. */
const goalsSurfaces: SurfaceDescriptor[] = [
  {
    id: 'goals-surface',
    label: 'Goals',
    title: 'Goal Workspace',
    icon: 'target',
    placement: 'viewport',
    tag: 'goals-surface',
  },
];

/** Goals app descriptor — one bundle of contributions plus the shell contract. */
export const GOALS_APP: AppDescriptor<'goals'> = defineApp({
  bundle: defineBundle({
    id: 'goals',
    name: 'Goals',
    description: 'Teleological workspace — create, track, and achieve goals.',
    surfaces: {
      viewport: goalsSurfaces,
    },
  }),
  icon: 'target',
  defaultLens: 'goal',
  defaultGraphLayer: 'both',
  defaultCapabilityFilter: 'all',
  connection: {
    url: '/ws',
    reconnect: true,
  },
  capability: 'language',
});

/** The Goals app id for registration and routing. */
export const GOALS_APP_ID = GOALS_APP.id;