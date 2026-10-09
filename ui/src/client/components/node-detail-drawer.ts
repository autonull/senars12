import type { GraphNodeData } from '@senars/core';
import { debounce } from '@senars/util';
import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { EDGE_TYPES } from '../../shared/constants.js';
import { artifactViewSpec } from '../core/artifacts.js';
import { type ExplainLink, explainModel } from '../core/explain.js';
import { generateId } from '../core/index.js';
import {
  $focusTerm,
  $graphEdges,
  $graphNodes,
  $nodeHistory,
  $selectedEdgeId,
  $selectedNodeId,
  $selectedNodeIds,
  $view,
  $workspaceGraph,
  BaseComponent,
  eventBus,
  narsBackend,
  type RevisionEntry,
  resolveBlockRef,
  linkRefFor,
  revealBlock,
  send,
  setWorkspaceSelection,
  updateEdgeData,
  updateNodeData,
  applyWorkspaceOp,
  type SemanticBlock,
  type WorkspaceOp,
} from '../core/index.js';
import { fieldMeta, formatField } from '../utils/field-catalog.js';
import { renderField } from '../utils/render-field.js';
import { theme } from '../utils/theme.js';

type TabId = 'overview' | 'links' | 'actions' | 'edge' | 'history';

/** Convert engine-prefixed nodeType (e.g. "nar:concept", "metta:atom") to a user-friendly label. */
function formatNodeType(nodeType: string): string {
  const labels: Record<string, string> = {
    'nar:concept': 'Concept',
    'metta:atom': 'Atom',
    'metta:skill': 'Skill',
  };
  return labels[nodeType] ?? nodeType;
}

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
    .link-item { display: flex; align-items: baseline; gap: var(--spacing-scale-2); width: 100%; padding: var(--spacing-scale-2) 0; border: none; border-bottom: 1px solid var(--colors-semantic-border-subtle); background: transparent; color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); text-align: left; cursor: pointer; transition: var(--transitions-fast); }
    .link-item:hover { color: var(--colors-semantic-accent-primary); }
    .link-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip { flex-shrink: 0; color: var(--colors-semantic-text-muted); font-variant-numeric: tabular-nums; }
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
  /**
   * One coalesced writer per kind of edit. The target id travels as an argument
   * rather than closing over it, so dragging a slider sends the *current* node's
   * id and frequency together instead of a stale pair captured at arm time — the
   * per-id map that avoided the capture reintroduced the drift this removes, and
   * grew with every node the user ever touched.
   */
  private readonly commitNodeTruth = debounce(
    (nodeId: string, frequency: number, confidence: number) => {
      send({
        type: 'object.set',
        kind: 'node',
        id: nodeId,
        patch: { truth: { frequency, confidence } },
      });
    },
    120
  );

  private readonly commitEdgeTruth = debounce(
    (edgeId: string, frequency: number, confidence: number) => {
      send({
        type: 'object.set',
        kind: 'edge',
        id: edgeId,
        patch: { truth: { frequency, confidence } },
      });
    },
    120
  );

  override disconnectedCallback(): void {
    this.commitNodeTruth.cancel();
    this.commitEdgeTruth.cancel();
    super.disconnectedCallback();
  }

  override connectedCallback() {
    super.connectedCallback();
    this.watchWith($selectedNodeId, (id) => {
      this.edgeData = null;
      if (id) {
        this.node = $graphNodes.get().get(id) ?? null;
        this.syncTruth();
        this.activeTab = 'overview';
        this.fetchHistory();
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
          <button class="tab ${this.activeTab === tab ? 'active' : ''}" @click=${() => {
            this.activeTab = tab;
          }}>
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

  private onEdgeTruthInput(value: number) {
    this.edgeTruthFrequency = value;
    const ed = this.edgeData;
    if (!ed) return;
    const key = `${ed.source}->${ed.target}`;
    updateEdgeData(key, { weight: value });
    this.commitEdgeTruth(key, value, (ed.confidence as number) ?? 0.9);
  }

  private onEdgeTypeChange(value: string) {
    this.edgeType = value;
    const ed = this.edgeData;
    if (!ed) return;
    const key = `${ed.source}->${ed.target}`;
    updateEdgeData(key, { type: value });
    send({ type: 'object.set', kind: 'edge', id: key, patch: { type: value } });
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

  private onTruthInput(value: number) {
    this.truthFrequency = value;
    const node = this.node;
    if (!node) return;
    const nodeId = node.id ?? '';
    updateNodeData(nodeId, {
      truth: { frequency: value, confidence: this.truthConfidence },
    });
    this.commitNodeTruth(nodeId, value, this.truthConfidence);
  }

  private fetchHistory() {
    if (!this.node?.term) return;
    send({ type: 'node.history.request', term: this.node.term });
  }

  /** The links touching the node's block, as the explanation model reports them. */
  private get explainedLinks(): ExplainLink[] {
    const ref = this.blockRef;
    const model = ref ? explainModel($workspaceGraph.get(), ref) : undefined;
    const filter = this.linkFilter.toLowerCase();
    return (model?.links ?? []).filter(
      (link) =>
        !filter ||
        link.otherLabel.toLowerCase().includes(filter) ||
        link.label.toLowerCase().includes(filter)
    );
  }

  private copyTerm() {
    if (this.node?.term) {
      navigator.clipboard.writeText(this.node.term).catch(() => {});
    }
  }

  private pinNode() {
    if (this.node) {
      const ids = new Set($selectedNodeIds.get());
      ids.add(this.node.id ?? '');
      setWorkspaceSelection(ids);
    }
  }

  private hideNode() {
    if (this.node) {
      const nodes = new Map($graphNodes.get());
      nodes.delete(this.node.id ?? '');
      $graphNodes.set(nodes);
      $selectedNodeId.set(null);
    }
  }

  private renderOverview() {
    const n = this.node;
    if (!n) return html``;
    const nodeId = n.id ?? '';
    const truthColor = this.truthToColor(this.truthFrequency);
    return html`
      <div class="section-title">Node Details</div>
      <div class="field"><span class="field-label">Term</span><span class="field-value">${n.term ?? n.label ?? nodeId}</span></div>
      <div class="field"><span class="field-label">Type</span><span class="field-value">${formatNodeType(n.nodeType)}</span></div>
      <div class="field"><span class="field-label">${fieldMeta('node.priority').label}</span><span class="field-value">${formatField('node.priority', n.priority)}</span></div>
      <div class="field"><span class="field-label">${fieldMeta('node.confidence').label}</span><span class="field-value">${formatField('node.confidence', n.confidence)}</span></div>
      ${n.isContradiction ? html`<div class="field"><span class="field-label">Contradiction</span><span class="field-value" style="color:${theme.colors.accentAmber}">⚠ Detected</span></div>` : ''}
      <div class="section-title">Truth Value</div>
      <div class="field">
        <span class="field-label">${fieldMeta('truth.frequency').label}</span>
        <span class="field-value" style="display:flex;align-items:center;gap:6px">
          ${renderField(
            {
              type: 'slider',
              min: 0,
              max: 1,
              step: 0.01,
              style: `width:80px;accent-color:${truthColor}`,
            },
            this.truthFrequency,
            (v) => this.onTruthInput(Number(v))
          )}
          <span style="color:${truthColor};font-weight:bold">${formatField('truth.frequency', this.truthFrequency)}</span>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${truthColor}"></span>
        </span>
      </div>
      <div class="field"><span class="field-label">${fieldMeta('truth.confidence').label}</span><span class="field-value">${formatField('truth.confidence', this.truthConfidence)}</span></div>
      ${n.punctuation ? html`<div class="field"><span class="field-label">Punctuation</span><span class="field-value">${n.punctuation}</span></div>` : ''}
    `;
  }

  private renderEdge() {
    const ed = this.edgeData;
    if (!ed) return html``;
    const hasTruth = ed.weight !== undefined;
    const nodes = $graphNodes.get();
    const sourceLabel = nodes.get(ed.source as string)?.label ?? (ed.source as string);
    const targetLabel = nodes.get(ed.target as string)?.label ?? (ed.target as string);
    const edgeId = `${ed.source}->${ed.target}`;
    const linkRef = linkRefFor(narsBackend, edgeId);
    const graph = $workspaceGraph.get();
    const targetRef = resolveBlockRef(graph, narsBackend, String(ed.target));
    const targetBlock = targetRef ? graph.blocks.get(targetRef) : undefined;
    const linkViewSpec = targetBlock ? artifactViewSpec(targetBlock) : undefined;
    return html`
      <div class="section-title">Edge Details</div>
      <div class="field"><span class="field-label">Source</span><span class="field-value">${sourceLabel}</span></div>
      <div class="field"><span class="field-label">Target</span><span class="field-value">${targetLabel}</span></div>
      <div class="field">
        <span class="field-label">Type</span>
        <span class="field-value">
          ${renderField(
            {
              type: 'dropdown',
              style:
                'background:var(--colors-semantic-bg-base);color:var(--colors-semantic-text-primary);border:1px solid var(--colors-semantic-border-subtle);border-radius:var(--borderRadius-component-input);font-family:var(--typography-fontFamilies-data);font-size:var(--typography-scale-xs);padding:var(--spacing-scale-1)',
              options: Object.entries(EDGE_TYPES).map(([value, label]) => ({ value, label })),
            },
            this.edgeType,
            (v) => this.onEdgeTypeChange(String(v))
          )}
        </span>
      </div>
      <div class="section-title">Weight</div>
      <div class="field">
        <span class="field-label">Strength</span>
        <span class="field-value" style="display:flex;align-items:center;gap:6px">
          ${renderField(
            {
              type: 'slider',
              min: 0,
              max: 1,
              step: 0.01,
              style: 'width:80px;accent-color:var(--colors-semantic-accent-primary)',
            },
            this.edgeTruthFrequency,
            (v) => this.onEdgeTruthInput(Number(v))
          )}
          <span style="font-weight:bold">${this.edgeTruthFrequency.toFixed(2)}</span>
        </span>
      </div>
      <div class="section-title">Edge Actions</div>
      ${
        linkRef
          ? html`<button class="action-btn" data-action="open-block" @click=${() => revealBlock(linkRef)}>
            Open in Notebook
          </button>`
          : ''
      }
      ${
        linkViewSpec && targetRef
          ? html`<button class="action-btn" data-action="open-view" @click=${() => eventBus.emit('overlay:open', { id: 'artifact', ref: targetRef })}>
            Open View
          </button>`
          : ''
      }
    `;
  }

  /** One explained link: which way it runs, what it relates, and how sure the engine is. */
  private renderLinkRow(link: ExplainLink) {
    const { confidence, eventRefs } = link;
    return html`
      <button
        class="link-item"
        data-other=${link.other}
        title=${`${link.label} · ${link.otherLabel}`}
        @click=${() => revealBlock(link.other)}
      >
        <span class="link-type">${link.direction === 'out' ? '→' : '←'} ${link.label}</span>
        <span class="link-label">${link.otherLabel}</span>
        ${confidence === undefined ? '' : html`<span class="chip">c${confidence.toFixed(2)}</span>`}
        ${
          eventRefs.length > 0
            ? html`<span class="chip" title=${eventRefs.join(', ')}>${eventRefs.length} events</span>`
            : ''
        }
      </button>
    `;
  }

  private renderLinks() {
    if (!this.blockRef) {
      return html`<div class="empty">No projected block to explain</div>`;
    }
    const links = this.explainedLinks;
    const direction = (way: ExplainLink['direction']) =>
      links.filter((link) => link.direction === way);
    const section = (title: string, rows: readonly ExplainLink[], empty: string) => html`
      <div class="section-title">${title} (${rows.length})</div>
      ${
        rows.length === 0
          ? html`<div class="empty">${empty}</div>`
          : rows.map((link) => this.renderLinkRow(link))
      }
    `;
    return html`
      ${renderField(
        { type: 'text', className: 'link-filter', placeholder: 'Filter links…', on: 'input' },
        this.linkFilter,
        (v) => {
          this.linkFilter = String(v);
          this.requestUpdate();
        }
      )}
      ${section('Outgoing', direction('out'), 'No outgoing links')}
      ${section('Incoming', direction('in'), 'No incoming links')}
    `;
  }

  /**
   * The block this node projects to (§2.4's node→block mapping). The substrate is
   * the authority: an id the graph already carries is a ref, an engine id resolves
   * through the attached backend, and a node the backend does not carry has no
   * block — so the affordances that need one stay hidden.
   */
  private get blockRef(): string | undefined {
    const id = this.node?.id;
    return id ? resolveBlockRef($workspaceGraph.get(), narsBackend, id) : undefined;
  }

  /** The projected block's artifact spec, when it has one (`4.3` affordances). */
  private get blockViewSpec() {
    const ref = this.blockRef;
    const block = ref ? $workspaceGraph.get().blocks.get(ref) : undefined;
    return block ? artifactViewSpec(block) : undefined;
  }

  private openInNotebook = () => {
    revealBlock(this.blockRef);
  };

  private openBlockView = () => {
    const ref = this.blockRef;
    if (!ref) return;
    eventBus.emit('overlay:open', { id: 'artifact', ref });
  };

  private renderActions() {
    const ref = this.blockRef;
    const node = this.node;
    return html`
      <div class="section-title">Node Actions</div>
      <button class="action-btn" @click=${this.focusOnNode}>Focus Term</button>
      ${
        ref
          ? html`<button class="action-btn" data-action="open-block" @click=${this.openInNotebook}>
            Open in Notebook
          </button>`
          : ''
      }
      ${
        this.blockViewSpec
          ? html`<button class="action-btn" data-action="open-view" @click=${this.openBlockView}>
            Open View
          </button>`
          : ''
      }
      <button class="action-btn" @click=${this.pinNode}>Pin to Selection</button>
      <button class="action-btn" @click=${this.copyTerm}>Copy Term</button>
      <button class="action-btn" @click=${this.hideNode}>Hide from Graph</button>
      <button class="action-btn" @click=${this.exportSubgraph}>Export Subgraph</button>
      ${node ? html`
        <div class="section-title">Formalize</div>
        <button class="action-btn" @click=${() => this.createBlockFromNode('question')}>
          Ask as question
        </button>
        <button class="action-btn" @click=${() => this.createBlockFromNode('claim')}>
          Assert as claim
        </button>
      ` : ''}
    `;
  }

  private createBlockFromNode(kind: 'question' | 'claim') {
    const node = this.node;
    if (!node) return;
    const term = node.term ?? node.label ?? '';
    if (!term) return;

    const block: SemanticBlock = {
      id: generateId(kind),
      kind,
      role: 'user',
      title: kind === 'question' ? `Question: ${term}` : `Claim: ${term}`,
      text: term,
      sourceRefs: [node.id ?? ''],
      status: 'complete',
      createdAt: Date.now(),
      createdBy: 'user',
    };

    const op: WorkspaceOp = { op: 'block.add', block };
    const graph = $workspaceGraph.get();
    $workspaceGraph.set(applyWorkspaceOp(graph, op));
    revealBlock(block.id);
  }

  private renderHistory() {
    if (this.history.length === 0) {
      return html`<div class="empty">No history available</div>`;
    }
    return html`
      <div class="section-title">Revision History</div>
      ${this.history.map(
        (entry) => html`
        <div class="field">
          <span class="field-label">${new Date(entry.timestamp).toLocaleTimeString()}</span>
          <span class="field-value">
            f=${entry.truth.frequency.toFixed(2)} c=${entry.truth.confidence.toFixed(2)}
            <button @click=${() => this.seekToTime(entry.timestamp)}>Seek</button>
          </span>
        </div>
      `
      )}
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
    const start = this.node?.id;
    if (!start) return;
    const nodes = $graphNodes.get();
    const edges = $graphEdges.get();
    const ids = new Set<string>([start]);
    for (const ed of edges.values()) {
      if (ed.source === start) ids.add(ed.target);
      else if (ed.target === start) ids.add(ed.source);
    }
    const data = {
      nodes: [...ids].map((id) => nodes.get(id)).filter(Boolean),
      edges: [...edges.values()].filter((ed) => ids.has(ed.source) && ids.has(ed.target)),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subgraph-${start}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'node-detail-drawer': NodeDetailDrawer;
  }
}
