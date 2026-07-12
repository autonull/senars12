import type { AgentCapabilities, CognitiveEvent, CognitiveEventSource } from '@senars/core';
import { type NAR, termParser } from '@senars/nar';
import type { WebSocket } from 'ws';
import { LENS_FIELDS } from '../shared/constants.js';
import type { LensSpec } from '../shared/lens-schema.js';
import type {
  ConfigFieldType,
  GraphNodeData,
  GraphOp,
  IncomingFromServer,
  Lens,
} from '../shared/protocol.js';
import { DEFAULT_PROJECTION } from './config.js';
import { lensRegistry } from './gateway.js';
import { computeActiveSubgraph } from './projection.js';

interface ConceptLike {
  id: string;
  label: string;
  priority: number;
  confidence: number;
  nodeType: 'nar:concept' | 'metta:atom' | 'metta:skill';
  isContradiction?: boolean;
  space?: string;
  skill?: string;
  durationMs?: number;
  getLinks?: () => Array<{ target: string; strength: number }>;
}

interface BridgeState {
  concepts: Map<string, ConceptLike>;
  seqId: number;
  currentLens: Lens;
  focusTerm: string | null;
  lastSnapshot: {
    nodes: ConceptLike[];
    edges: Array<{ source: string; target: string; weight: number }>;
  } | null;
}

function createNodeOp(id: string, data: GraphNodeData): GraphOp {
  return { action: 'add_node' as const, id, data };
}

function createEdgeOp(source: string, target: string, weight: number, type = 'semantic'): GraphOp {
  return { action: 'add_edge' as const, source, target, data: { weight, type, directed: true } };
}

interface RelationLink {
  subject: string;
  predicate: string;
  type: 'inheritance' | 'similarity' | 'instance';
}

const COPULA_RE = /[(<](.+?)\s*(-->|<->|\{--|--]|{-]|=->)\s*(.+?)[>)]/g;

function parseRelations(input: string): RelationLink[] {
  const links: RelationLink[] = [];
  if (!input) return links;
  for (const stmt of input.split(';')) {
    for (const m of stmt.matchAll(COPULA_RE)) {
      const cop = m[2] ?? '';
      const type: RelationLink['type'] =
        cop === '<->' ? 'similarity' : cop === '{--' ? 'instance' : 'inheritance';
      links.push({ subject: (m[1] ?? '').trim(), predicate: (m[3] ?? '').trim(), type });
    }
  }
  return links;
}

function ensureConcept(state: BridgeState, ops: GraphOp[], id: string, label = id): void {
  if (state.concepts.has(id)) return;
  const concept: ConceptLike = {
    id,
    label,
    priority: 0.5,
    confidence: 0.9,
    nodeType: 'nar:concept',
    isContradiction: false,
  };
  state.concepts.set(id, concept);
  ops.push(createNodeOp(id, toGraphNodeData(concept)));
}

function addRelationEdges(state: BridgeState, ops: GraphOp[], input: string): void {
  for (const rel of parseRelations(input)) {
    ensureConcept(state, ops, rel.subject);
    ensureConcept(state, ops, rel.predicate);
    ops.push(createEdgeOp(rel.subject, rel.predicate, 0.6, rel.type));
  }
}

function deriveRelationEdges(state: BridgeState): GraphOp[] {
  const ops: GraphOp[] = [];
  const seenNodes = new Set<string>();
  for (const concept of state.concepts.values()) {
    if (concept.nodeType !== 'nar:concept') continue;
    const rels = parseRelations(concept.label);
    for (const rel of rels) {
      if (!state.concepts.has(rel.subject) || !state.concepts.has(rel.predicate)) continue;
      for (const ep of [rel.subject, rel.predicate]) {
        if (!seenNodes.has(ep)) {
          seenNodes.add(ep);
          const endpoint = state.concepts.get(ep);
          if (endpoint) ops.push(createNodeOp(ep, toGraphNodeData(endpoint)));
        }
      }
      ops.push(createEdgeOp(rel.subject, rel.predicate, 0.6, rel.type));
    }
  }
  return ops;
}

function toGraphNodeData(concept: ConceptLike): GraphNodeData {
  if (concept.nodeType === 'metta:skill') {
    return {
      id: concept.id,
      nodeType: 'metta:skill',
      skill: concept.skill ?? concept.label,
      args: [],
      result: concept.label,
      durationMs: concept.durationMs ?? 0,
    };
  }
  if (concept.nodeType === 'metta:atom') {
    return {
      id: concept.id,
      nodeType: 'metta:atom',
      atom: concept.label,
      space: concept.space ?? 'default',
    };
  }
  return {
    id: concept.id,
    nodeType: 'nar:concept',
    term: concept.label,
    priority: concept.priority,
    confidence: concept.confidence,
    isContradiction: concept.isContradiction ?? false,
  };
}

function projectCognitiveEvent(event: CognitiveEvent, state: BridgeState): GraphOp[] {
  const ops: GraphOp[] = [];

  switch (event.type) {
    case 'derivation': {
      const nodeId = `deriv:${event.correlationId}:${Date.now()}`;
      const concept: ConceptLike = {
        id: nodeId,
        label: event.term.slice(0, 50),
        priority: event.confidence,
        confidence: event.confidence,
        nodeType: event.engine === 'metta' ? 'metta:atom' : 'nar:concept',
        isContradiction: false,
      };
      state.concepts.set(nodeId, concept);
      ops.push(createNodeOp(nodeId, toGraphNodeData(concept)));
      addRelationEdges(state, ops, event.term);
      break;
    }

    case 'cycle': {
      const cycleId = `cycle:${event.correlationId}`;
      const concept: ConceptLike = {
        id: cycleId,
        label: `Cycle ${event.cycle}`,
        priority: event.derived > 0 ? 0.8 : 0.2,
        confidence: 1.0,
        nodeType: 'nar:concept',
        isContradiction: false,
      };
      state.concepts.set(cycleId, concept);
      ops.push(createNodeOp(cycleId, toGraphNodeData(concept)));
      break;
    }

    case 'skill:executed': {
      const skillId = `skill:${event.skill}`;
      const concept: ConceptLike = {
        id: skillId,
        label: event.skill,
        priority: 0.7,
        confidence: 1.0,
        nodeType: 'metta:skill',
        skill: event.skill,
        durationMs: event.durationMs,
      };
      state.concepts.set(skillId, concept);
      ops.push(createNodeOp(skillId, toGraphNodeData(concept)));
      break;
    }

    case 'concept:activated': {
      const concept: ConceptLike = {
        id: event.term,
        label: event.term,
        priority: event.priority,
        confidence: 0.9,
        nodeType: event.engine === 'metta' ? 'metta:atom' : 'nar:concept',
        isContradiction: false,
      };
      state.concepts.set(event.term, concept);
      ops.push(createNodeOp(event.term, toGraphNodeData(concept)));
      addRelationEdges(state, ops, event.term);
      break;
    }

    case 'drive:changed': {
      if (event.engine !== 'nar') break;
      const driveId = `drive:${event.drive}`;
      const concept: ConceptLike = {
        id: driveId,
        label: event.drive,
        priority: event.urgency,
        confidence: 1.0,
        nodeType: 'nar:concept',
        isContradiction: false,
      };
      state.concepts.set(driveId, concept);
      ops.push(createNodeOp(driveId, toGraphNodeData(concept)));
      break;
    }

    case 'goal:resolved': {
      const goalId = `goal:${event.term}`;
      const concept: ConceptLike = {
        id: goalId,
        label: event.term,
        priority: 0.5,
        confidence: 1.0,
        nodeType: 'nar:concept',
        isContradiction: false,
      };
      state.concepts.set(goalId, concept);
      ops.push(createNodeOp(goalId, toGraphNodeData(concept)));
      break;
    }

    case 'conflict:detected': {
      const conflictId = `conflict:${event.term}:${Date.now()}`;
      const concept: ConceptLike = {
        id: conflictId,
        label: `${event.term} conflicts with ${event.conflictWith}`,
        priority: 0.9,
        confidence: 1.0,
        nodeType: 'nar:concept',
        isContradiction: true,
      };
      state.concepts.set(conflictId, concept);
      ops.push(createNodeOp(conflictId, toGraphNodeData(concept)));
      ops.push(createEdgeOp(event.term, event.conflictWith, 0.7, 'conflict'));
      break;
    }

    case 'input': {
      const inputId = `input:${event.term}:${Date.now()}`;
      const concept: ConceptLike = {
        id: inputId,
        label: event.term,
        priority: 0.7,
        confidence: 1.0,
        nodeType: 'nar:concept',
        isContradiction: false,
      };
      state.concepts.set(inputId, concept);
      ops.push(createNodeOp(inputId, toGraphNodeData(concept)));
      addRelationEdges(state, ops, event.term);
      break;
    }

    case 'health':
      break;
  }

  return ops;
}

function scoreForLens(concept: ConceptLike, lens: Lens): number {
  switch (lens) {
    case 'belief':
      return concept.confidence * concept.priority;
    case 'goal':
      return concept.nodeType === 'nar:concept' ? concept.priority : 0;
    case 'contradiction':
      return concept.isContradiction ? 1 : 0;
    default:
      return concept.confidence * concept.priority;
  }
}

function buildFullGraph(
  state: BridgeState,
  lens?: Lens
): { ops: GraphOp[]; meta?: { truncated: boolean; totalHidden: number } } {
  const concepts = [...state.concepts.values()];

  if (lens) {
    const scored = concepts
      .map((c) => ({ concept: c, score: scoreForLens(c, lens) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DEFAULT_PROJECTION.maxNodes);

    const nodeIds = new Set(scored.map((s) => s.concept.id));
    const ops: GraphOp[] = scored.map(({ concept }) =>
      createNodeOp(concept.id, toGraphNodeData(concept))
    );

    for (const { concept } of scored) {
      const links = concept.getLinks?.() ?? [];
      for (const link of links) {
        if (nodeIds.has(link.target)) {
          ops.push(createEdgeOp(concept.id, link.target, link.strength));
        }
      }
    }

    const truncated = concepts.length > DEFAULT_PROJECTION.maxNodes;
    return {
      ops: [...ops, ...deriveRelationEdges(state)],
      meta: truncated
        ? { truncated: true, totalHidden: concepts.length - scored.length }
        : undefined,
    };
  }

  const proj = computeActiveSubgraph(
    concepts.map((c) => ({
      term: c.id,
      priority: c.priority,
      confidence: c.confidence,
      getLinks: c.getLinks ?? (() => []),
    })),
    state.focusTerm,
    DEFAULT_PROJECTION
  );

  const nodeIds = new Set(proj.nodes.map((n) => n.id));
  const ops: GraphOp[] = [
    ...proj.nodes
      .filter((n) => nodeIds.has(n.id))
      .map((n) =>
        createNodeOp(
          n.id,
          toGraphNodeData({
            id: n.id,
            label: n.id,
            priority: n.priority,
            confidence: n.confidence,
            nodeType: 'nar:concept',
            isContradiction: false,
          })
        )
      ),
    ...proj.edges.map((e) => createEdgeOp(e.source, e.target, e.weight)),
    ...deriveRelationEdges(state),
  ];

  return {
    ops,
    meta: proj.truncated ? { truncated: true, totalHidden: proj.total_hidden } : undefined,
  };
}

export class CognitiveBridge {
  #state: BridgeState = {
    concepts: new Map(),
    seqId: Date.now(),
    currentLens: 'belief',
    focusTerm: null,
    lastSnapshot: null,
  };

  #capabilities: AgentCapabilities | AgentCapabilities[] | null = null;
  #eventSource: CognitiveEventSource | null = null;
  #sendFn: ((msg: IncomingFromServer) => void) | null = null;
  #telemetryTimer: ReturnType<typeof setInterval> | null = null;
  #nar: NAR | null = null;

  constructor(nar?: NAR) {
    this.#nar = nar ?? null;
  }

  setNAR(nar: NAR): void {
    this.#nar = nar;
  }

  #onEvent = (event: CognitiveEvent): void => {
    const ops = projectCognitiveEvent(event, this.#state);
    if (ops.length > 0) this.#sendDelta(ops);
  };

  mount(source: CognitiveEventSource, sendFn: (msg: IncomingFromServer) => void): void {
    if (this.#eventSource !== source) {
      this.unmount();
      this.#eventSource = source;
      source.on('*', this.#onEvent);
    }
    this.#sendFn = sendFn;
    this.#capabilities = source.capabilities();
    this.#startTelemetry();
  }

  unmount(): void {
    if (this.#eventSource) {
      this.#eventSource.off('*', this.#onEvent);
    }
    this.#eventSource = null;
    this.#sendFn = null;
    if (this.#telemetryTimer) {
      clearInterval(this.#telemetryTimer);
      this.#telemetryTimer = null;
    }
  }

  syncFromNAR(): void {
    if (!this.#nar) return;
    try {
      const nar = this.#nar;
      const ops: GraphOp[] = [];
      const ensureRelConcept = (endpoint: string): void => {
        if (this.#state.concepts.has(endpoint)) return;
        const priority = this.#lookupConceptPriority(endpoint);
        const conceptLike: ConceptLike = {
          id: endpoint,
          label: endpoint,
          priority,
          confidence: 0.9,
          nodeType: 'nar:concept',
          isContradiction: false,
        };
        this.#state.concepts.set(endpoint, conceptLike);
        ops.push(createNodeOp(endpoint, toGraphNodeData(conceptLike)));
      };

      for (const concept of nar.listConcepts()) {
        const term = concept.term.toString();
        const rels = parseRelations(term);
        if (rels.length === 0) continue;

        if (!this.#state.concepts.has(term)) {
          const conceptLike: ConceptLike = {
            id: term,
            label: term,
            priority: concept.priority,
            confidence: 0.9,
            nodeType: 'nar:concept',
            isContradiction: false,
          };
          this.#state.concepts.set(term, conceptLike);
          ops.push(createNodeOp(term, toGraphNodeData(conceptLike)));
        }

        for (const rel of rels) {
          ensureRelConcept(rel.subject);
          ensureRelConcept(rel.predicate);
          ops.push(createEdgeOp(rel.subject, rel.predicate, 0.6, rel.type));
        }
      }

      if (ops.length > 0) this.#sendDelta(ops);
    } catch (err) {
      console.error('[bridge] syncFromNAR error:', err);
    }
  }

  #lookupConceptPriority(term: string): number {
    if (!this.#nar) return 0.5;
    try {
      const concept = this.#nar.getConcept(termParser.parse(term));
      return concept?.priority ?? 0.5;
    } catch {
      return 0.5;
    }
  }

  listConcepts(): Array<{
    term: string;
    priority: number;
    confidence: number;
    isContradiction?: boolean;
    getLinks(): Array<{ target: string; strength: number }>;
  }> {
    return [...this.#state.concepts.values()].map((c) => ({
      term: c.id,
      priority: c.priority,
      confidence: c.confidence,
      isContradiction: c.isContradiction,
      getLinks: c.getLinks ?? (() => []),
    }));
  }

  getSystemEventBus(): {
    on(event: string, handler: (...args: unknown[]) => void): () => void;
  } {
    const source = this.#eventSource;
    if (!source) return { on: () => () => {} };
    return {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        const wrapped = (data: unknown) => handler(data);
        source.on(event, wrapped as (e: CognitiveEvent) => void);
        return () => {
          source.off(event, wrapped as (e: CognitiveEvent) => void);
        };
      },
    };
  }

  attentionReport(): { concepts: Array<{ term: string; priority: number }> } {
    return {
      concepts: [...this.#state.concepts.values()].map((c) => ({
        term: c.id,
        priority: c.priority,
      })),
    };
  }

  getDriveManager():
    | {
        getAllStates(): Array<{
          spec: { id: string; name: string };
          currentIntensity: number;
          isActive: boolean;
        }>;
      }
    | undefined {
    const drives = [...this.#state.concepts.values()].filter((c) => c.nodeType === 'nar:concept');
    return drives.length > 0
      ? {
          getAllStates() {
            return drives.map((d) => ({
              spec: { id: d.id, name: d.label },
              currentIntensity: d.priority,
              isActive: d.priority > 0.1,
            }));
          },
        }
      : undefined;
  }

  getConfigSchema(): Record<string, ConfigFieldType> {
    const caps = this.#capabilities;
    if (!caps) return {};
    const cap = Array.isArray(caps) ? caps[0] : caps;
    if (!cap) return {};
    const schema = cap.configSchema ?? {};
    const result: Record<string, ConfigFieldType> = {};
    for (const [key, value] of Object.entries(schema)) {
      result[key] = value as ConfigFieldType;
    }
    return result;
  }

  setConfig(key: string, value: unknown): void {
    if (this.#eventSource) {
      this.#eventSource.submit(`config.set ${key} ${JSON.stringify(value)}`, crypto.randomUUID());
    }
  }

  setNodeTruth(id: string, truth: { frequency: number; confidence: number }): void {
    const concept = this.#state.concepts.get(id);
    if (concept) {
      concept.confidence = truth.confidence;
      if (this.#eventSource) {
        this.#eventSource.submit(
          `node.truth ${id} ${truth.frequency} ${truth.confidence}`,
          crypto.randomUUID()
        );
      }
    }
  }

  getRevisionHistory(_term: string): Array<{
    truth: { frequency: number; confidence: number };
    stampId: string;
    timestamp: number;
    source: 'input' | 'derivation' | 'revision' | 'inference';
  }> {
    return [];
  }

  getCapabilities(): AgentCapabilities | AgentCapabilities[] | null {
    return this.#capabilities;
  }

  setFocus(term: string | null): void {
    this.#state.focusTerm = term;
    this.refreshView();
  }

  setLens(lens: Lens): void {
    this.#state.currentLens = lens;
    this.refreshView();
  }

  refreshView(): void {
    const { ops, meta } = buildFullGraph(this.#state, this.#state.currentLens);
    this.#sendFn?.({
      type: 'cognitive.delta',
      seqId: ++this.#state.seqId,
      lens: this.#state.currentLens,
      ops,
      meta,
    });
  }

  sendInitialState(): void {
    this.#sendFn?.({ type: 'config.schema', data: this.getConfigSchema() });
    this.#sendFn?.({ type: 'lens.fields', fields: LENS_FIELDS });
    this.sendLensList();
    this.refreshView();
  }

  sendLensList(): void {
    const lenses: LensSpec[] = [...lensRegistry.values()];
    this.#sendFn?.({
      type: 'lens.list',
      lenses: lenses as LensSpec[],
    } as IncomingFromServer);
  }

  onNodeHistoryRequest(term: string): void {
    this.#sendFn?.({ type: 'node.history', term, history: [] } as IncomingFromServer);
  }

  onLensDefine(spec: LensSpec): void {
    lensRegistry.set(spec.id, spec);
    this.#sendFn?.({ type: 'lens.defined', lens: spec } as IncomingFromServer);
  }

  subscribeEvents(socket: WebSocket, currentLens: () => Lens): () => void {
    let seqId = this.#state.seqId;
    const handler = () => {
      const { ops, meta } = buildFullGraph(this.#state, currentLens());
      this.#sendFn?.({ type: 'cognitive.delta', seqId: ++seqId, lens: currentLens(), ops, meta });
    };

    if (this.#eventSource) {
      this.#eventSource.on('*', handler);
    }

    return () => {
      if (this.#eventSource) {
        this.#eventSource.off('*', handler);
      }
    };
  }

  reset(): void {
    this.#state = {
      concepts: new Map(),
      seqId: Date.now(),
      currentLens: 'belief',
      focusTerm: null,
      lastSnapshot: null,
    };
  }

  #sendDelta(ops: GraphOp[]): void {
    if (ops.length === 0) return;
    this.#sendFn?.({
      type: 'cognitive.delta',
      seqId: ++this.#state.seqId,
      lens: this.#state.currentLens,
      ops,
    });
  }

  #startTelemetry(): void {
    if (this.#telemetryTimer) clearInterval(this.#telemetryTimer);
    this.#telemetryTimer = setInterval(() => {
      const concepts = this.#state.concepts.size;
      this.#sendFn?.({
        type: 'telemetry',
        metrics: {
          reasoning_hz: 0,
          tokens_per_sec: 0,
          memory_mb: process.memoryUsage().heapUsed / 1024 / 1024,
          ws_latency_ms: 0,
        },
        cognitive: {
          activeConcepts: concepts,
          totalConcepts: concepts,
          derivationsPerSec: 0,
          contradictionCount: [...this.#state.concepts.values()].filter((c) => c.isContradiction)
            .length,
          workingMemorySize: concepts,
          goalUrgencyDistribution: { high: 0, medium: 0, low: concepts },
        },
      });
    }, 1000);
  }
}

export function createCognitiveBridge(nar?: NAR): CognitiveBridge {
  return new CognitiveBridge(nar);
}
