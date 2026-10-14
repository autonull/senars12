/**
 * Notebook — the semantic notebook app.
 *
 * A conversation surface rendering the section model as vertically sequenced
 * pages. Demonstrates the Notebook renderer as a standalone app.
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  $activeLens,
  $collapsedBlocks,
  $connectionState,
  $workspaceGraph,
  BaseComponent,
  narsBackend,
  projectWorkspaceGraph,
  send,
  setWorkspaceFocus,
  toggleCollapsed,
} from '../../kernel/index.js';
import { defineApp, type AppDescriptor } from '../../framework/app.js';
import { defineBundle } from '../../framework/bundle.js';
import { type SurfaceDescriptor } from '../../framework/surface.js';
import { LENS_FACETS } from '../../utils/lens-catalog.js';
import { GRAPH_LAYER_FACETS } from '../../core/graph-layer-defs.js';
import { FILTER_FACETS } from '../../core/filter-facets.js';
import { blockDescriptor } from '../../core/block-descriptors.js';
import { breadcrumb } from '../../core/navigation.js';
import { admittedRoots, isAdmitted, type SectionNode, sectionTree } from '../../core/sections.js';
import { $embeddedViews, embeddedViewMeta, embeddedViewSpec } from '../../core/embedded-views.js';
import { collectSources } from '../../core/citations.js';
import { blockBodyStyles, renderBlockBody } from '../../utils/render-block.js';
import '../../components/primitives/empty-state.js';
import type { BlockKind } from '../../core/block-descriptors.js';
import type { Source } from '../../core/citations.js';

const isSection = (block: { kind: string }): boolean => blockDescriptor(block.kind as BlockKind).section;

function uncertaintyChip(block: { uncertainty?: { frequency: number; confidence: number; vocabulary?: string } }): TemplateResult {
  const { uncertainty } = block;
  if (!uncertainty) return html``;
  return html`<span class="chip" title=${uncertainty.vocabulary ?? 'uncertainty'}>
    f${uncertainty.frequency.toFixed(2)} c${uncertainty.confidence.toFixed(2)}
  </span>`;
}

function renderBlock(block: { kind: string; id: string; role: string; status?: string; title?: string; text?: string; uncertainty?: { frequency: number; confidence: number; vocabulary?: string } }, options: { sources: readonly Source[]; views?: TemplateResult; focused?: boolean; fold?: { folded: boolean; toggle: () => void }; depth?: number; admitted?: boolean }): TemplateResult {
  return html`
    <article
      class="block"
      data-id=${block.id}
      data-kind=${block.kind}
      data-depth=${options.depth ?? 0}
      data-admitted=${options.admitted}
      data-role=${block.role}
      data-status=${block.status ?? 'complete'}
      data-focused=${options.focused}
      aria-current=${options.focused}
      @click=${() => setWorkspaceFocus(block.id)}
    >
      <header class="block-head">
        <span class="kind">${blockDescriptor(block.kind as BlockKind).label}</span>
        ${block.title && !isSection(block) && block.title !== blockDescriptor(block.kind as BlockKind).label
          ? html`<span class="title">${block.title}</span>`
          : ''}
        <span class="meta">
          ${uncertaintyChip(block)}
          ${
            options.fold
              ? html`<button
                  class="fold"
                  title=${options.fold.folded ? 'Expand' : 'Collapse'}
                  aria-expanded=${!options.fold.folded}
                  @click=${(event: Event) => {
                    event.stopPropagation();
                    options.fold!.toggle();
                  }}
                >${options.fold.folded ? '▸' : '▾'}</button>`
              : ''
          }
          <button class="more" title="Block actions" aria-label="Block actions" @click=${(
            event: Event
          ) => {
            event.stopPropagation();
            // eventBus.emit('overlay:open', { id: 'block-menu', ref: block.id, anchor: event.currentTarget as HTMLElement });
          }}>⋯</button>
        </span>
      </header>
      ${renderBlockBody(block as any, options.sources)} ${options.views ?? ''}
    </article>
  `;
}

/** The Notebook app surface — mounted in the viewport. */
@customElement('notebook-surface')
export class NotebookSurface extends BaseComponent {
  static override styles = [
    blockBodyStyles,
    css`
    :host {
      display: block;
      overflow: auto;
      height: 100%;
      padding: var(--spacing-scale-4);
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
      overflow: auto;
      position: relative;
    }
    .pages {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-4);
      max-width: 72ch;
      margin: 0 auto;
      padding: var(--spacing-scale-4);
    }
    .page {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-2);
    }
    .page:not(:first-child) {
      border-top: 1px solid var(--colors-semantic-border-subtle);
      padding-top: var(--spacing-scale-4);
    }
    .node {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-2);
      margin-left: var(--spacing-scale-4);
      padding-left: var(--spacing-scale-3);
      border-left: 1px solid var(--colors-semantic-border-subtle);
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-1);
      padding: var(--spacing-scale-3);
      border-radius: 6px;
      background: var(--colors-semantic-bg-subtle);
    }
    .block[data-role='user'] {
      border-left: 3px solid var(--colors-semantic-accent-cyan);
    }
    .block[data-role='assistant'] {
      border-left: 3px solid var(--colors-semantic-accent-violet);
    }
    .block[data-status='streaming'] {
      opacity: 0.85;
    }
    .block[data-admitted='false'] {
      opacity: 0.35;
    }
    .block-head {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      font-size: var(--typography-scale-xs);
    }
    .kind {
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--colors-semantic-text-muted);
    }
    .title {
      color: var(--colors-semantic-text-secondary);
      font-weight: var(--typography-fontWeights-medium);
    }
    .meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
      margin-left: auto;
    }
    .breadcrumb {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spacing-scale-1);
      max-width: 72ch;
      margin: 0 auto var(--spacing-scale-3);
      font-size: var(--typography-scale-xs);
    }
    .breadcrumb .crumb {
      border: none;
      background: transparent;
      color: var(--colors-semantic-text-muted);
      cursor: pointer;
      padding: 0;
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-xs);
    }
    .breadcrumb .crumb:hover {
      color: var(--colors-semantic-text-primary);
    }
    .breadcrumb .crumb[aria-current='true'] {
      color: var(--colors-semantic-text-secondary);
    }
    .breadcrumb .sep {
      color: var(--colors-semantic-text-muted);
    }
    .more {
      border: none;
      background: transparent;
      color: var(--colors-semantic-text-muted);
      cursor: pointer;
      font-size: var(--typography-scale-base);
      line-height: 1;
      padding: 0 var(--spacing-scale-1);
    }
    .more:hover {
      color: var(--colors-semantic-text-primary);
    }
    .fold {
      border: none;
      background: transparent;
      color: var(--colors-semantic-text-muted);
      cursor: pointer;
      font-size: var(--typography-scale-xs);
      line-height: 1;
      padding: 0 var(--spacing-scale-1);
    }
    .fold:hover {
      color: var(--colors-semantic-text-primary);
    }
    [data-folded='true'] {
      background: var(--colors-semantic-bg-subtle);
      border-radius: 6px;
    }
    .block[data-focused='true'] {
      outline: 1px solid var(--colors-semantic-accent-cyan);
    }
    .embed {
      margin-top: var(--spacing-scale-2);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 6px;
      overflow: hidden;
    }
    .embed-label {
      display: block;
      padding: var(--spacing-scale-1) var(--spacing-scale-2);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      color: var(--colors-semantic-text-muted);
      font-family: var(--typography-fontFamilies-ui);
      font-size: var(--typography-scale-xs);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .embed s-view {
      max-height: 16rem;
      padding: var(--spacing-scale-2);
    }
    .chip {
      padding: 0 var(--spacing-scale-1);
      border-radius: 4px;
      background: var(--colors-semantic-bg-overlay);
      color: var(--colors-semantic-text-secondary);
      font-family: var(--typography-fontFamilies-data);
    }
    .empty {
      margin: auto;
      max-width: 460px;
      text-align: center;
      color: var(--colors-semantic-text-muted);
      line-height: 1.6;
    }
    .empty h2 {
      font-size: 16px;
      font-weight: 600;
      color: var(--colors-semantic-text-primary);
      margin: 0 0 8px;
    }
    .empty code {
      font-family: var(--typography-fontFamilies-data, monospace);
      background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 4px;
      padding: 1px 5px;
    }
    `,
  ];

  @state() private activeLens = 'belief';
  @state() private activeGraphLayer = 'both';
  @state() private activeFilter = 'all';
  #scrolledFocus?: string;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($activeLens);
    this.watch($collapsedBlocks);
    this.watch($embeddedViews);
    this.watchWith($workspaceGraph, () => this.requestUpdate());
  }

  override updated(): void {
    const focus = $workspaceGraph.get().focus;
    if (focus === undefined || focus === this.#scrolledFocus) return;
    this.#scrolledFocus = focus;
    const escaped = globalThis.CSS?.escape?.(focus) ?? focus;
    this.renderRoot
      .querySelector<HTMLElement>(`[data-id="${escaped}"]`)
      ?.scrollIntoView?.({ block: 'center' });
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

  protected override render(): TemplateResult {
    const graph = $workspaceGraph.get();
    const tree = sectionTree(graph, $collapsedBlocks.get());
    const sources = collectSources(graph);
    const shown = $embeddedViews.get();
    const crumbs = breadcrumb(graph, graph.focus);
    const cursor = graph.timeCursor;

    const embedded = (block: { id: string; kind: string; role: string; title?: string }): TemplateResult | undefined => {
      const views = shown.get(block.id);
      if (!views) return undefined;
      return html`${[...views].map((id) => {
        const meta = embeddedViewMeta(id);
        return html`<div class="embed" data-embed=${id}>
          <span class="embed-label">${meta.label}</span>
          <s-view .spec=${embeddedViewSpec(block as any, id)} .chrome=${false} .budget=${'embedded'}></s-view>
        </div>`;
      })}`;
    };

    const renderNode = (node: SectionNode): TemplateResult => {
      const fold =
        node.children.length > 0
          ? { folded: node.folded, toggle: () => toggleCollapsed(node.ref) }
          : undefined;
      const header = node.children.length > 0 ? { ...node.block, text: undefined } : node.block;
      return html`
        <section
          class=${node.depth === 0 ? 'page' : 'node'}
          data-id=${node.ref}
          data-depth=${node.depth}
          data-folded=${node.folded}
        >
          ${renderBlock(header as any, {
            sources,
            views: embedded(header),
            focused: graph.focus === node.ref,
            fold,
            depth: node.depth,
            admitted: isAdmitted(node.block, cursor),
          })}
          ${node.folded ? '' : node.children.map(renderNode)}
        </section>
      `;
    };

    const status = $connectionState.get();

    return html`
      <div class="app">
        <header>
          <span class="wordmark">SeNARS</span>
          <span class="tagline">Notebook — semantic conversation surface</span>
          ${this.renderToolbar()}
          <span class="status">
            <span class="dot ${status}"></span>${status}
          </span>
        </header>
        <div class="viewport">
          ${crumbs.length > 0
            ? html`<nav class="breadcrumb" aria-label="Breadcrumb">
                ${crumbs.map(
                  (crumb, index) => html`
                    ${index > 0 ? html`<span class="sep">›</span>` : ''}
                    <button
                      class="crumb"
                      data-ref=${crumb.ref}
                      aria-current=${index === crumbs.length - 1}
                      @click=${() => setWorkspaceFocus(crumb.ref)}
                    >${blockDescriptor(crumb.kind).label} · ${crumb.label}</button>
                  `
                )}
              </nav>`
            : ''}
          <div class="pages">
            ${graph.roots.length === 0
              ? html`<s-empty-state
                  icon="notebook"
                  heading="Empty notebook"
                  description="Send a message to start the semantic notebook"
                  size="lg"
                ></s-empty-state>`
              : admittedRoots(tree, cursor).map(renderNode)}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notebook-surface': NotebookSurface;
  }
}

/** Notebook app surfaces — just the viewport surface. */
const notebookSurfaces: SurfaceDescriptor[] = [
  {
    id: 'notebook-surface',
    label: 'Notebook',
    title: 'Semantic Notebook',
    icon: 'notebook',
    placement: 'viewport',
    tag: 'notebook-surface',
  },
];

/** Notebook app descriptor — one bundle of contributions plus the shell contract. */
export const NOTEBOOK_APP: AppDescriptor<'notebook'> = defineApp({
  bundle: defineBundle({
    id: 'notebook',
    name: 'Notebook',
    description: 'Semantic conversation surface — vertically sequenced pages with folding sections.',
    surfaces: {
      viewport: notebookSurfaces,
    },
  }),
  icon: 'notebook',
  defaultLens: 'belief',
  defaultGraphLayer: 'both',
  defaultCapabilityFilter: 'all',
  connection: {
    url: '/ws',
    reconnect: true,
  },
  capability: 'language',
});

/** The Notebook app id for registration and routing. */
export const NOTEBOOK_APP_ID = NOTEBOOK_APP.id;