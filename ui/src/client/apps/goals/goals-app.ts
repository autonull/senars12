import { css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  $activeLens,
  $graphLayer,
  $graphShape,
  $viewportMode,
  $workspaceGraph,
  BaseComponent,
  narsBackend,
  send,
} from '../../kernel/index.js';
import { defineApp, type AppDescriptor } from '../../framework/app.js';
import { defineBundle } from '../../framework/bundle.js';
import type { Composition } from '../../framework/composition.js';
import { type SurfaceDescriptor } from '../../framework/surface.js';
import { projectWorkspaceGraph } from '../../kernel/domain.js';
import '../../components/graph-viewport.js';

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

  @state() private draft = '';
  @state() private projection = { nodes: new Map(), edges: new Map() };

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($activeLens);
    this.watch($graphLayer);
    this.watchWith($workspaceGraph, () => this.updateProjection());
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

/** Goals' default composition — one graph-bearing cell; the shell supplies the chrome. */
const goalsComposition: Composition = {
  id: 'goals',
  name: 'Goals',
  layout: 'auto',
  cells: [{ surface: 'goals-surface' }],
  globals: {
    lens: 'goal',
    layer: 'both',
    shape: 'graph',
    mode: '2d',
    fit: 'legible',
    filter: 'all',
  },
};

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
  composition: goalsComposition,
  defaultLens: 'goal',
  defaultGraphLayer: 'both',
  defaultCapabilityFilter: 'all',
  connection: {
    url: '/ws',
    reconnect: true,
  },
  capability: 'language',
});

/** The Goals app id for registration and registration. */
export const GOALS_APP_ID = GOALS_APP.id;