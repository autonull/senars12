import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { GraphNodeData } from '../../shared/protocol.js';
import { EDGE_TYPES, edgeTypeLabel } from '../../shared/constants.js';
import {
  $focusTerm,
  $graphEdges,
  $graphNodes,
  $nodeHistory,
  $selectedEdgeId,
  $selectedNodeId,
  $selectedNodeIds,
  $view,
  type RevisionEntry,
  BaseComponent,
  send,
  updateEdgeData,
  updateNodeData,
} from '../core/index.js';

type TabId = 'overview' | 'links' | 'actions' | 'edge' | 'history';

@customElement('node-detail-drawer')
export class NodeDetailDrawer extends BaseComponent {
  static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .tabs { display: flex; border-bottom: 1px solid var(--colors-semantic-border-subtle); flex-shrink: 0; }
    .tab { flex: 1; padding: var(--spacing-scale-2) var(--spacing-scale-3); border: none; background: transparent; color: var(--colors-semantic-text-muted); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: var(--transitions-fast); }
    .tab:hover { color: var(--colors-semantic-text-primary); background: var(--colors-semantic-bg-panel); }
    .tab.active { color: var(--colors-semantic-accent-primary); border-bottom: 2px solid var(--colors-semantic-accent-primary); }
    .content { flex: 1; overflow-y: auto; padding: var(--spacing-scale-3); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); }
    .field { display: flex; justify-content: space-between; padding: var(--spacing-scale-2) 0; border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    .field-label { color: var(--colors-semantic-text-muted); }
    .field-value { color: var(--colors-semantic-text-primary); font-variant-numeric: tabular-nums; }
    .section-title { font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); text-transform: uppercase; letter-spacing: 1px; margin: var(--spacing-scale-3) 0 var(--spacing-scale-2); }
    .link-item { display: flex; align-items: center; gap: var(--spacing-scale-2); padding: var(--spacing-scale-2) 0; border-bottom: 1px solid var(--colors-semantic-border-subtle); cursor: pointer; }
    .link-item:hover { color: var(--colors-semantic-accent-primary); }
    .link-type { font-size: 0.6rem; color: var(--colors-semantic-text-muted); background: var(--colors-semantic-bg-panel); padding: 1px 4px; border-radius: 2px; text-transform: uppercase; }
    .action-btn { display: flex; align-items: center; gap: var(--spacing-scale-2); width: 100%; padding: var(--spacing-scale-2) var(--spacing-scale-3); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-button); background: transparent; color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); cursor: pointer; margin-bottom: var(--spacing-scale-2); transition: var(--transitions-fast); }
    .action-btn:hover { border-color: var(--colors-semantic-accent-primary); color: var(--colors-semantic-accent-primary); }
    .link-filter { width: 100%; background: var(--colors-semantic-bg-base); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-input); color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); padding: var(--spacing-scale-1) var(--spacing-scale-2); outline: none; margin-bottom: var(--spacing-scale-2); }
    .link-filter:focus { border-color: var(--colors-semantic-border-focus); }
    .empty { color: var(--colors-semantic-text-muted); text-align: center; padding: var(--spacing-scale-4); font-style: italic; }
  `;
  @state() private activeTab: TabId = 'overview';
  @state() private node: GraphNodeData | null = null;
  @state() private edgeData: Record<string, unknown> | null = null;
  @state() private history: RevisionEntry[] = [];
  @state() private linkFilter = '';
  @state() private truthFrequency = 0.5;
  @state() private truthConfidence = 0.9;
  @state() private edgeTruthFrequency = 0.5;
  @state() private edgeType = 'inheritance';
  private truthDebounce: ReturnType<typeof setTimeout> | null = null;
  private edgeTruthDebounce: ReturnType<typeof setTimeout> | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($selectedNodeId, (id) => {
      this.edgeData = null;
      if (id) {
        this.node = $graphNodes.get().get(id) ?? null;
        this.syncTruth();
        this.activeTab = 'overview';
      } else {
        this.node = null;
      }
    });
    this.watchWith($selectedEdgeId, (id) => {
      this.node = null;
      if (id) {
        this.edgeData = $graphEdges.get().get(id) ?? null;
        this.syncEdgeTruth();
        this.activeTab = 'edge';
      } else {
        this.edgeData = null;
      }
    });
    this.watchWith($graphNodes, () => {
      const id = $selectedNodeId.get();
      if (id) {
        this.node = $graphNodes.get().get(id) ?? null;
        this.syncTruth();
      }
    });
    this.watchWith($graphEdges, () => {
      const id = $selectedEdgeId.get();
      if (id) {
        this.edgeData = $graphEdges.get().get(id) ?? null;
        this.syncEdgeTruth();
      }
    });
    this.watchWith($nodeHistory, (history) => {
      this.history = history;
    });
  }

  private syncEdgeTruth() {
    const ed = this.edgeData;
    if (ed) {
      this.edgeTruthFrequency = (ed.weight as number) ?? 0.5;
      this.edgeType = (ed.type as string) ?? 'inheritance';
    } else {
      this.edgeTruthFrequency = 0.5;
      this.edgeType = 'inheritance';
    }
  }

  private onEdgeTruthInput(e: Event) {
    const f = Number.parseFloat((e.target as HTMLInputElement).value);
    this.edgeTruthFrequency = f;
    const ed = this.edgeData;
    if (!ed) return;
    const key = `${ed.source}->${ed.target}`;
    updateEdgeData(key, { weight: f });
    if (this.edgeTruthDebounce) clearTimeout(this.edgeTruthDebounce);
    this.edgeTruthDebounce = setTimeout(() => {
      send({
        type: 'object.set',
        kind: 'edge',
        id: key,
        patch: { truth: { frequency: f, confidence: (ed.confidence as number) ?? 0.9 } },
      });
    }, 120);
  }

  private onEdgeTypeChange(e: Event) {
    const t = (e.target as HTMLSelectElement).value;
    this.edgeType = t;
    const ed = this.edgeData;
    if (!ed) return;
    const key = `${ed.source}->${ed.target}`;
    updateEdgeData(key, { type: t });
    send({ type: 'object.set', kind: 'edge', id: key, patch: { type: t } });
  }

  private syncTruth() {
    const n = this.node;
    if (n?.truth) {
      this.truthFrequency = n.truth.frequency;
      this.truthConfidence = n.truth.confidence;
    } else {
      this.truthFrequency = 0.5;
      this.truthConfidence = 0.9;
    }
  }

  private truthToColor(f: number): string {
    const hue = Math.round(f * 120);
    return `hsl(${hue}, 70%, 50%)`;
  }

  private onTruthInput(e: Event) {
    const f = Number.parseFloat((e.target as HTMLInputElement).value);
    this.truthFrequency = f;
    const node = this.node;
    if (!node) return;
    updateNodeData(node.id, {
      truth: { frequency: f, confidence: this.truthConfidence },
    });
    if (this.truthDebounce) clearTimeout(this.truthDebounce);
    this.truthDebounce = setTimeout(() => {
      send({
        type: 'object.set',
        kind: 'node',
        id: node.id,
        patch: { truth: { frequency: f, confidence: this.truthConfidence } },
      });
    }, 120);
  }

  override render() {
    if (!this.node && !this.edgeData) return html``;

    if (this.edgeData && !this.node) {
      return html`
        <div class="tabs">
          <button class="tab active">Edge</button>
        </div>
        <div class="content">
          ${this.renderEdge()}
        </div>
      `;
    }

    return html`
      <div class="tabs">
        ${(['overview', 'links', 'actions', 'history'] as const).map(
          (tab) => html`
          <button class="tab ${this.activeTab === tab ? 'active' : ''}" @click=${() => (this.activeTab = tab)}>
            ${tab === 'overview' ? 'Overview' : tab === 'links' ? 'Links' : tab === 'history' ? 'History' : 'Actions'}
          </button>
        `
        )}
      </div>
      <div class="content">
        ${this.activeTab === 'overview' ? this.renderOverview() : ''}
        ${this.activeTab === 'links' ? this.renderLinks() : ''}
        ${this.activeTab === 'actions' ? this.renderActions() : ''}
        ${this.activeTab === 'history' ? this.renderHistory() : ''}
      </div>
    `;
  }

  private fetchHistory() {
    if (!this.node?.term) return;
    send({ type: 'node.history.request', term: this.node.term });
  }

  private getLinks() {
    if (!this.node)
      return {
        in: [] as { id: string; label: string; type: string }[],
        out: [] as { id: string; label: string; type: string }[],
      };
    const edges = $graphEdges.get();
    const inLinks: { id: string; label: string; type: string }[] = [];
    const outLinks: { id: string; label: string; type: string }[] = [];
    const nodes = $graphNodes.get();

    for (const [key, ed] of edges) {
      const filter = this.linkFilter.toLowerCase();
      if (ed.source === this.node.id) {
        const target = nodes.get(ed.target);
        const label = target?.label ?? ed.target;
        if (
          !filter ||
          label.toLowerCase().includes(filter) ||
          (ed.type ?? '').toLowerCase().includes(filter)
        ) {
          outLinks.push({ id: ed.target, label, type: ed.type ?? 'relation' });
        }
      }
      if (ed.target === this.node.id) {
        const source = nodes.get(ed.source);
        const label = source?.label ?? ed.source;
        if (
          !filter ||
          label.toLowerCase().includes(filter) ||
          (ed.type ?? '').toLowerCase().includes(filter)
        ) {
          inLinks.push({ id: ed.source, label, type: ed.type ?? 'relation' });
        }
      }
    }
    return { in: inLinks, out: outLinks };
  }

  private focusNode(id: string) {
    $selectedNodeId.set(id);
    send({ type: 'focus.set', term: id });
  }

  private copyTerm() {
    if (this.node?.term) {
      navigator.clipboard.writeText(this.node.term).catch(() => {});
    }
  }

  private pinNode() {
    if (this.node) {
      const ids = new Set($selectedNodeIds.get());
      ids.add(this.node.id);
      $selectedNodeIds.set(ids);
    }
  }

  private hideNode() {
    if (this.node) {
      const nodes = new Map($graphNodes.get());
      nodes.delete(this.node.id);
      $graphNodes.set(nodes);
      $selectedNodeId.set(null);
    }
  }

  private renderOverview() {
    const n = this.node!;
    const truthColor = this.truthToColor(this.truthFrequency);
    return html`
      <div class="section-title">Node Details</div>
      <div class="field"><span class="field-label">Term</span><span class="field-value">${n.term ?? n.label ?? n.id}</span></div>
      <div class="field"><span class="field-label">Type</span><span class="field-value">${n.nodeType}</span></div>
      <div class="field"><span class="field-label">Priority</span><span class="field-value">${n.priority?.toFixed(3) ?? '—'}</span></div>
      <div class="field"><span class="field-label">Confidence</span><span class="field-value">${n.confidence?.toFixed(3) ?? '—'}</span></div>
      ${n.isContradiction ? html`<div class="field"><span class="field-label">Contradiction</span><span class="field-value" style="color:#ffaa00">⚠ Detected</span></div>` : ''}
      <div class="section-title">Truth Value</div>
      <div class="field">
        <span class="field-label">Frequency</span>
        <span class="field-value" style="display:flex;align-items:center;gap:6px">
          <input type="range" min="0" max="1" step="0.01" .value=${String(this.truthFrequency)} @input=${this.onTruthInput} style="width:80px;accent-color:${truthColor}" />
          <span style="color:${truthColor};font-weight:bold">${this.truthFrequency.toFixed(2)}</span>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${truthColor}"></span>
        </span>
      </div>
      <div class="field"><span class="field-label">Confidence</span><span class="field-value">${this.truthConfidence.toFixed(3)}</span></div>
      ${n.punctuation ? html`<div class="field"><span class="field-label">Punctuation</span><span class="field-value">${n.punctuation}</span></div>` : ''}
    `;
  }

  private renderEdge() {
    const ed = this.edgeData!;
    const hasTruth = ed.weight !== undefined;
    const nodes = $graphNodes.get();
    const sourceLabel = nodes.get(ed.source as string)?.label ?? (ed.source as string);
    const targetLabel = nodes.get(ed.target as string)?.label ?? (ed.target as string);
    return html`
      <div class="section-title">Edge Details</div>
      <div class="field"><span class="field-label">Source</span><span class="field-value">${sourceLabel}</span></div>
      <div class="field"><span class="field-label">Target</span><span class="field-value">${targetLabel}</span></div>
      <div class="field">
        <span class="field-label">Type</span>
        <span class="field-value">
          <select @change=${this.onEdgeTypeChange} style="background:var(--colors-semantic-bg-base);color:var(--colors-semantic-text-primary);border:1px solid var(--colors-semantic-border-subtle);border-radius:var(--borderRadius-component-input);font-family:var(--typography-fontFamilies-data);font-size:var(--typography-scale-xs);padding:var(--spacing-scale-1)">
            ${Object.entries(EDGE_TYPES).map(
              ([val, label]) => html`
            <option value=${val} ?selected=${this.edgeType === val}>${label}</option>
            `
            )}
          </select>
        </span>
      </div>
      <div class="section-title">Weight</div>
      <div class="field">
        <span class="field-label">Strength</span>
        <span class="field-value" style="display:flex;align-items:center;gap:6px">
          <input type="range" min="0" max="1" step="0.01" .value=${String(this.edgeTruthFrequency)} @input=${this.onEdgeTruthInput} style="width:80px;accent-color:var(--colors-semantic-accent-primary)" />
          <span style="font-weight:bold">${this.edgeTruthFrequency.toFixed(2)}</span>
        </span>
      </div>
    `;
  }

  private renderLinks() {
    const { in: inLinks, out: outLinks } = this.getLinks();
    return html`
      <input class="link-filter" type="text" placeholder="Filter links…" .value=${this.linkFilter} @input=${(
        e: Event
      ) => {
        this.linkFilter = (e.target as HTMLInputElement).value;
        this.requestUpdate();
      }} />
      <div class="section-title">Outgoing (${outLinks.length})</div>
      ${
        outLinks.length === 0
          ? html`<div class="empty">No outgoing links</div>`
          : outLinks.map(
              (l) => html`
        <div class="link-item" @click=${() => this.focusNode(l.id)}>
          <span class="link-type">${l.type}</span>
          <span>${l.label}</span>
        </div>
      `
            )
      }
      <div class="section-title">Incoming (${inLinks.length})</div>
      ${
        inLinks.length === 0
          ? html`<div class="empty">No incoming links</div>`
          : inLinks.map(
              (l) => html`
        <div class="link-item" @click=${() => this.focusNode(l.id)}>
          <span class="link-type">${l.type}</span>
          <span>${l.label}</span>
        </div>
      `
            )
      }
    `;
  }

  private renderActions() {
    return html`
      <div class="section-title">Node Actions</div>
      <button class="action-btn" @click=${this.focusOnNode}>Focus Term</button>
      <button class="action-btn" @click=${this.pinNode}>Pin to Selection</button>
      <button class="action-btn" @click=${this.copyTerm}>Copy Term</button>
      <button class="action-btn" @click=${this.hideNode}>Hide from Graph</button>
      <button class="action-btn" @click=${this.exportSubgraph}>Export Subgraph</button>
    `;
  }

  private renderHistory() {
    if (this.history.length === 0) {
      return html`<div class="empty">No history available</div>`;
    }
    return html`
      <div class="section-title">Revision History</div>
      ${this.history.map((entry) => html`
        <div class="field">
          <span class="field-label">${new Date(entry.timestamp).toLocaleTimeString()}</span>
          <span class="field-value">
            f=${entry.truth.frequency.toFixed(2)} c=${entry.truth.confidence.toFixed(2)}
            <button @click=${() => this.seekToTime(entry.timestamp)}>Seek</button>
          </span>
        </div>
      `)}
    `;
  }

  private seekToTime(t: number) {
    $view.set({ ...$view.get(), timeline: { t } });
  }

  private focusOnNode() {
    if (this.node?.term) {
      $focusTerm.set(this.node.term);
      send({ type: 'focus.set', term: this.node.term });
    }
  }

  private exportSubgraph() {
    const nodes = $graphNodes.get();
    const edges = $graphEdges.get();
    const data = {
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subgraph-${this.node?.id ?? 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'node-detail-drawer': NodeDetailDrawer;
  }
}
