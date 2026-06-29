import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  $activeLens,
  $connectionState,
  $graphNodes,
  $lensLayout,
  $panels,
  $selectedNodeIds,
  $urlState,
  $viewport,
  BaseComponent,
  eventBus,
  send,
} from '../core/index.js';
import './contradiction-badge.js';
import './lens-controller.js';

const STATUS_COLORS: Record<string, string> = {
  connected: 'var(--colors-semantic-status-connected)',
  connecting: 'var(--colors-semantic-status-connecting)',
  reconnecting: 'var(--colors-semantic-status-reconnecting)',
  disconnected: 'var(--colors-semantic-status-disconnected)',
};

@customElement('graph-toolbar')
export class GraphToolbar extends BaseComponent {
  static override styles = css`
    :host {
      display: flex; align-items: center; height: 44px; padding: 0 var(--spacing-scale-3);
      gap: var(--spacing-scale-2); background: var(--colors-semantic-bg-panel-solid);
      border-bottom: 1px solid var(--colors-semantic-border-subtle);
      font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs);
    }
    .zoom-group { display: flex; align-items: center; gap: 2px; }
    .zoom-pct { min-width: 32px; text-align: center; color: var(--colors-semantic-text-muted); font-variant-numeric: tabular-nums; }
    .search-input {
      background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-component-input); color: var(--colors-semantic-text-primary);
      font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs);
      padding: 2px 6px; width: 140px; outline: none; transition: var(--transitions-fast);
    }
    .search-input:focus { border-color: var(--colors-semantic-border-focus); width: 200px; }
    .search-input::placeholder { color: var(--colors-semantic-text-muted); }
    .spacer { flex: 1; }
    .status-indicator { display: flex; align-items: center; gap: var(--spacing-scale-2); }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; }
    .layout-select {
      background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: var(--borderRadius-component-input); color: var(--colors-semantic-text-secondary);
      font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs);
      padding: 2px 4px; outline: none; cursor: pointer;
    }
    .toolbar-btn {
      display: flex; align-items: center; justify-content: center;
      background: none; border: 1px solid transparent; border-radius: var(--borderRadius-component-button);
      color: var(--colors-semantic-text-muted); font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs); padding: 2px 6px; cursor: pointer;
      transition: var(--transitions-fast); white-space: nowrap;
    }
    .toolbar-btn:hover { color: var(--colors-semantic-text-primary); border-color: var(--colors-semantic-border-default); background: var(--colors-semantic-bg-panel); }
    .toolbar-btn.active { color: var(--colors-semantic-accent-primary); border-color: var(--colors-semantic-accent-primary); }
    .toolbar-btn.icon { padding: 2px 4px; min-width: 22px; }
    .divider { width: 1px; height: 18px; background: var(--colors-semantic-border-subtle); margin: 0 var(--spacing-scale-1); }

    /* Multi-select bulk actions */
    .multi-select-bar {
      display: flex; align-items: center; gap: var(--spacing-scale-2);
      background: var(--colors-semantic-accent-primary-subtle);
      padding: 2px var(--spacing-scale-3); border-radius: var(--borderRadius-component-button);
    }
    .multi-select-count { color: var(--colors-semantic-accent-primary); font-weight: var(--typography-fontWeights-semibold); }
    .multi-select-btn {
      background: transparent; border: 1px solid var(--colors-semantic-accent-primary);
      color: var(--colors-semantic-accent-primary); font-family: var(--typography-fontFamilies-data);
      font-size: var(--typography-scale-xs); padding: 1px 6px; border-radius: var(--borderRadius-component-button);
      cursor: pointer; transition: var(--transitions-fast);
    }
    .multi-select-btn:hover { background: var(--colors-semantic-accent-primary); color: var(--colors-semantic-text-on-accent); }
  `;
  @state() private zoom = 1;
  @state() private searchQuery = '';
  @state() private multiSelectCount = 0;
  @state() private layoutName = 'cose';

  override connectedCallback() {
    super.connectedCallback();
    this.watch($activeLens);
    this.watch($connectionState);
    this.watchWith($viewport, (vp) => {
      this.zoom = vp.zoom;
    });
    this.watchWith($selectedNodeIds, (ids) => {
      this.multiSelectCount = ids.size;
    });
    this.watchWith($activeLens, (lens) => {
      this.layoutName = $lensLayout.get()[lens] ?? 'cose';
    });
    this.watchWith($lensLayout, (layouts) => {
      this.layoutName = layouts[$activeLens.get()] ?? 'cose';
    });
  }

  override render() {
    const activeLens = $activeLens.get();
    const state = $connectionState.get();
    const configOpen = $panels.get().get('config')?.open;

    return html`
      <div class="zoom-group">
        <button class="toolbar-btn icon" @click=${this.zoomOut} title="Zoom out" aria-label="Zoom out">−</button>
        <span class="zoom-pct">${Math.round(this.zoom * 100)}%</span>
        <button class="toolbar-btn icon" @click=${this.zoomIn} title="Zoom in" aria-label="Zoom in">+</button>
        <button class="toolbar-btn" @click=${this.fitGraph} title="Fit graph to viewport">Fit</button>
      </div>

      <div class="divider"></div>

      <input class="search-input" type="search" placeholder="Search nodes…"
        .value=${this.searchQuery} @input=${this.handleSearch} aria-label="Search nodes" />

      <div class="divider"></div>

      <lens-controller></lens-controller>

      <div class="divider"></div>

      <select class="layout-select" @change=${this.selectLayout} title="Graph layout" aria-label="Graph layout"
        .value=${this.layoutName}>
        <option value="cose">Cose</option>
        <option value="concentric">Concentric</option>
        <option value="concentric-urgency">Urgency</option>
        <option value="breadthfirst">Breadthfirst</option>
        <option value="preset">Preset</option>
      </select>

      <button class="toolbar-btn" @click=${this.toggleMinimap} title="Toggle minimap">Minimap</button>

      ${
        this.multiSelectCount > 0
          ? html`
        <div class="divider"></div>
        <div class="multi-select-bar">
          <span class="multi-select-count">${this.multiSelectCount}</span>
          <button class="multi-select-btn" @click=${this.focusSelected}>Focus</button>
          <button class="multi-select-btn" @click=${this.hideSelected}>Hide</button>
          <button class="multi-select-btn" @click=${this.clearSelection}>Clear</button>
        </div>
      `
          : ''
      }

      <div class="spacer"></div>

      <button class="toolbar-btn ${configOpen ? 'active' : ''}"
        @click=${() => this.togglePanel('config')} title="Toggle configuration panel">Config</button>

      <contradiction-badge></contradiction-badge>

      <div class="divider"></div>

      <div class="status-indicator">
        <span class="status-dot" style="background:${STATUS_COLORS[state]}" aria-hidden="true"></span>
        <span style="color:var(--colors-semantic-text-muted)">${state}</span>
      </div>
    `;
  }

  private handleSearch(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    this.searchQuery = value;
    const urlState = $urlState.get();
    $urlState.set({ ...urlState, search: value || undefined });
    eventBus.emit('graph:search', value);
  }

  private zoomIn() {
    eventBus.emit('graph:zoom-in');
  }

  private zoomOut() {
    eventBus.emit('graph:zoom-out');
  }

  private fitGraph() {
    eventBus.emit('graph:fit');
  }

  private selectLayout(e: Event) {
    eventBus.emit('graph:layout', (e.target as HTMLSelectElement).value);
  }

  private toggleMinimap() {
    eventBus.emit('graph:minimap-toggle');
  }

  private togglePanel(id: string) {
    const panels = new Map($panels.get());
    const panel = panels.get(id);
    if (panel) {
      panels.set(id, { ...panel, open: !panel.open });
      $panels.set(panels);
    }
  }

  // Multi-select bulk actions
  private focusSelected() {
    const ids = $selectedNodeIds.get();
    if (ids.size > 0) {
      // Send first selected as focus
      const first = ids.values().next().value;
      if (first) {
        const node = $graphNodes.get().get(first);
        if (node?.term) send({ type: 'focus.set', term: node.term });
      }
    }
  }

  private hideSelected() {
    const ids = $selectedNodeIds.get();
    if (ids.size === 0) return;
    const nodes = new Map($graphNodes.get());
    for (const id of ids) nodes.delete(id);
    $graphNodes.set(nodes);
    $selectedNodeIds.set(new Set());
  }

  private clearSelection() {
    $selectedNodeIds.set(new Set());
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'graph-toolbar': GraphToolbar;
  }
}
