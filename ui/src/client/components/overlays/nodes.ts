/**
 * Nodes overlay — concept explorer using the ViewSpec system.
 * Legacy nodes surface bridged to overlay + embedded view.
 */

import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { eventBus } from '../../core/events.js';
import { $graphNodes, $workspaceGraph, BaseComponent, send } from '../../core/index.js';
import type { GraphNodeData } from '@senars/core';
import { viewSource } from '../../core/view-sources.js';
import type { Shape, ViewSpec } from '../../core/view-spec.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';

@customElement('s-nodes')
export class NodesView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 14vh; left: 50%; transform: translateX(-50%); width: min(800px, 94vw); height: min(600px, 70vh); z-index: 1; }
    :host([hidden]) { display: none; }
    :host([data-pinned]) { position: fixed; top: var(--nodes-y, 14vh); left: var(--nodes-x, 50%); transform: var(--nodes-transform, translateX(-50%)); width: var(--nodes-w, min(800px, 94vw)); height: var(--nodes-h, min(600px, 70vh)); z-index: 1; }
    .panel { display: flex; flex-direction: column; height: 100%; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    .header { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2) var(--spacing-scale-3); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .title { font-weight: var(--typography-fontWeights-semibold); }
    .count { font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .toolbar { display: flex; gap: var(--spacing-scale-1); margin-left: auto; }
    .search { padding: var(--spacing-scale-1) var(--spacing-scale-2); border: 1px solid var(--colors-semantic-border-default); border-radius: var(--borderRadius-component-input); background: var(--colors-semantic-bg-base); color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); width: 200px; }
    .search:focus { outline: none; border-color: var(--colors-semantic-accent-primary); }
    .filter { display: flex; gap: var(--spacing-scale-1); padding: var(--spacing-scale-1) var(--spacing-scale-2); border-bottom: 1px solid var(--colors-semantic-border-subtle); flex-wrap: wrap; }
    .filter-btn { padding: 2px 8px; border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-button); background: transparent; color: var(--colors-semantic-text-secondary); cursor: pointer; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-xs); transition: var(--transitions-fast); }
    .filter-btn.active { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); background: var(--colors-semantic-accent-subtle); }
    .filter-btn:hover:not(.active) { border-color: var(--colors-semantic-border-default); color: var(--colors-semantic-text-primary); }
    .content { flex: 1; overflow: auto; }
    .empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--colors-semantic-text-muted); }
    s-view { height: 100%; }
  `;

  @state() private search = '';
  @state() private filterKind: string | 'all' = 'all';
  @state() private viewShape: Shape = 'table';
  @property({ type: Boolean }) embedded = false;

  override connectedCallback() {
    super.connectedCallback();
    this.watch($graphNodes);
    this.watch($workspaceGraph);
  }

  private getFilteredNodes(): GraphNodeData[] {
    const nodes = [...$graphNodes.get().values()];
    let filtered = nodes;

    if (this.search) {
      const q = this.search.toLowerCase();
      filtered = filtered.filter((n) =>
        n.label?.toLowerCase().includes(q) ||
        n.term?.toLowerCase().includes(q) ||
        n.id?.toLowerCase().includes(q)
      );
    }

    if (this.filterKind !== 'all') {
      filtered = filtered.filter((n) => n.nodeType === this.filterKind);
    }

    return filtered;
  }

  private getNodeKinds(): string[] {
    const kinds = new Set<string>();
    for (const node of $graphNodes.get().values()) {
      kinds.add(node.nodeType);
    }
    return [...kinds].sort();
  }

  private getViewSpec(): ViewSpec {
    const nodes = this.getFilteredNodes();
    const tableData = {
      kind: 'table' as const,
      columns: [
        { id: 'label', label: 'Concept', width: '40%' },
        { id: 'kind', label: 'Kind', width: '15%' },
        { id: 'truth', label: 'Truth', width: '20%' },
        { id: 'priority', label: 'Priority', width: '15%' },
      ],
      rows: nodes.map((n) => ({
        label: n.label ?? n.term ?? n.id ?? 'unknown',
        kind: n.nodeType,
        truth: n.truth ? `f${n.truth.frequency.toFixed(2)} c${n.truth.confidence.toFixed(2)}` : '—',
        priority: n.priority?.toFixed(2) ?? '—',
        _id: n.id ?? 'unknown',
      })),
    };

    return {
      id: 'overlay:nodes',
      title: 'Concepts',
      shapes: ['table', 'tree', 'text'],
      shape: this.viewShape,
      source: viewSource($graphNodes, () => tableData),
    };
  }

  private handleSearch(e: Event) {
    this.search = (e.target as HTMLInputElement).value;
  }

  private setFilter(kind: string | 'all') {
    this.filterKind = kind;
  }

  private setShape(shape: Shape) {
    this.viewShape = shape;
  }

  private close = () => eventBus.emit('overlay:close', { id: 'nodes' });

  private onPinChange = (event: CustomEvent<{ id: string; pinned: boolean }>): void => {
    this.toggleAttribute('data-pinned', event.detail.pinned);
  };

  protected override renderBody() {
    if (this.embedded) {
      return html`<s-view .spec=${this.getViewSpec()} .budget=${'embedded'} .chrome=${false}></s-view>`;
    }

    const nodes = this.getFilteredNodes();
    const kinds = this.getNodeKinds();

    return html`
      <div class="panel" role="dialog" aria-label="Concepts">
        <overlay-header
          overlay-id="nodes"
          title="Concepts"
          .draggable=${true}
          .resizable=${true}
          .pinnable=${true}
          .closeable=${true}
          @header-close=${this.close}
          @header-pin=${this.onPinChange}
        ></overlay-header>
        <div class="header">
          <span class="title">Concepts</span>
          <span class="count">${nodes.length} / ${$graphNodes.get().size}</span>
          <div class="toolbar">
            <input class="search" type="search" placeholder="Filter concepts…" .value=${this.search} @input=${this.handleSearch} />
          </div>
        </div>
        <div class="filter">
          <button class="filter-btn ${this.filterKind === 'all' ? 'active' : ''}" @click=${() => this.setFilter('all')}>All</button>
          ${kinds.map((kind) => html`
            <button class="filter-btn ${this.filterKind === kind ? 'active' : ''}" @click=${() => this.setFilter(kind)}>${kind}</button>
          `)}
        </div>
        <div class="content">
          ${
            nodes.length === 0
              ? html`<div class="empty">No concepts match the filter</div>`
              : html`<s-view .spec=${this.getViewSpec()} .budget=${'full'} .chrome=${true}></s-view>`
          }
        </div>
      </div>
    `;
  }
}

const NODES_SURFACE = { id: 'nodes', title: 'Concepts', group: 'overlay' } as const;

defineSurface(NODES_SURFACE, NodesView);
registerOverlay({
  id: NODES_SURFACE.id,
  title: NODES_SURFACE.title,
  tag: surfaceTag(NODES_SURFACE),
  window: { draggable: true, resizable: true, minimize: true, persist: true },
});

declare global {
  interface HTMLElementTagNameMap {
    's-nodes': NodesView;
  }
}