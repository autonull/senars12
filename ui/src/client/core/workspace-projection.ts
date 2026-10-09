/**
 * Projection from the current client state into the WorkspaceGraph (§0.2). The
 * chat log projects to ordered `turn` blocks with `responds-to`/`supports`/
 * `contradicts`/`derived-from` discourse links (and `references` when a turn
 * follows up on a block); whatever reasoning backend is attached projects its
 * substrate to `claim`/`tool-call` blocks with `derived-from`/`references` links
 * and the engine's own uncertainty. Both producers are pure and deterministic
 * (stable ids, sorted graph blocks), so a streaming reparse yields identical
 * blocks and the existing graph/event behavior is preserved rather than
 * re-owned.
 */

import type { ChatMessage, CognitiveEvent } from '@senars/core';
import { linkMeta } from '../utils/link-catalog.js';
import { decomposeForMode, DEFAULT_COMPOSER_MODE, isComposerMode } from './composer-modes.js';
import { isFaithfulDecomposition } from './input-decomposition.js';
import { NAL_VOCABULARY } from './nars-backend.js';
import type { ReasoningBackend } from './reasoning-backend.js';
import { segmentText } from './segmentation.js';
import { taskTypeForPunctuation } from '@senars/core';
import type {
  BlockKind,
  CreatedBy,
  Ref,
  SemanticBlock,
  SemanticLink,
  SemanticLinkKind,
  SemanticRole,
  Uncertainty,
  WorkspaceGraph,
} from './workspace-graph.js';

/** A partial projection — blocks, links and the root order contributed by one producer. */
export interface WorkspaceFragment {
  blocks: SemanticBlock[];
  links: SemanticLink[];
  roots: Ref[];
}

export const turnId = (messageId: Ref): Ref => `turn:${messageId}`;
export const claimId = (nodeId: Ref): Ref => `claim:${nodeId}`;
export const linkId = (source: Ref, target: Ref, kind: SemanticLinkKind): Ref =>
  `link:${source}->${target}:${kind}`;
/** The `derivation-record` block documenting one provenance edge (§3.3). */
export const derivationId = (edge: Ref): Ref => `derivation:${edge}`;

const ROLE_MAP = {
  user: { role: 'user', createdBy: 'user' },
  agent: { role: 'assistant', createdBy: 'lm' },
  system: { role: 'system', createdBy: 'system' },
} as const satisfies Record<
  ChatMessage['role'],
  { role: SemanticRole; createdBy: CreatedBy }
>;

const uncertaintyFrom = (truth?: { frequency: number; confidence: number }): Uncertainty | undefined =>
  truth ? { frequency: truth.frequency, confidence: truth.confidence, vocabulary: NAL_VOCABULARY } : undefined;

const link = (
  source: Ref,
  target: Ref,
  kind: SemanticLinkKind,
  createdBy: CreatedBy
): SemanticLink => ({ id: linkId(source, target, kind), source, target, kind, createdBy });

/** Stable id for a segmented child block of a message. */
export const childId = (messageId: Ref, index: number | string): Ref => `blk:${messageId}:${index}`;

/** Stable id for the raw-fidelity child of a decomposed input. */
export const rawChildId = (messageId: Ref): Ref => childId(messageId, 'raw');

const childBlock = (
  message: ChatMessage,
  id: Ref,
  kind: BlockKind,
  role: SemanticRole,
  createdBy: CreatedBy,
  text: string,
  extra: Partial<SemanticBlock> = {}
): SemanticBlock => ({
  id,
  kind,
  role,
  title: kind,
  text,
  status: 'complete',
  createdAt: message.timestamp,
  createdBy,
  ...extra,
});

/** Project the chat log into ordered turn blocks, segmented output children, and discourse links. */
export function projectChat(messages: readonly ChatMessage[]): WorkspaceFragment {
  const blocks: SemanticBlock[] = [];
  const links: SemanticLink[] = [];
  const roots: Ref[] = [];
  const ids = new Set(messages.map((message) => message.id));
  let lastUser: Ref | undefined;

  for (const message of messages) {
    const id = turnId(message.id);
    const { role, createdBy } = ROLE_MAP[message.role];
    const block: SemanticBlock = {
      id,
      kind: 'turn',
      role,
      title: message.role,
      text: message.content,
      uncertainty: uncertaintyFrom(message.truth),
      status: 'complete',
      createdAt: message.timestamp,
      createdBy,
    };

    if (message.role === 'agent') {
      const children: Ref[] = [];
      segmentText(message.content).forEach((segment, index) => {
        const blockId = childId(message.id, index);
        children.push(blockId);
        blocks.push(
          childBlock(message, blockId, segment.kind, role, createdBy, segment.text, {
            level: segment.level,
            data: segment.data,
          })
        );
        links.push(link(id, blockId, 'contains', createdBy));
      });
      if (children.length > 0) block.children = children;
    }

    if (message.role === 'user') {
      const children: Ref[] = [];
      const segments = decomposeForMode(
        message.content,
        isComposerMode(message.mode) ? message.mode : DEFAULT_COMPOSER_MODE
      );
      segments.forEach((segment, index) => {
        const blockId = childId(message.id, index);
        children.push(blockId);
        blocks.push(childBlock(message, blockId, segment.kind, role, createdBy, segment.text));
        links.push(link(id, blockId, 'contains', createdBy));
      });
      if (segments.length > 0 && !isFaithfulDecomposition(message.content, segments)) {
        const blockId = rawChildId(message.id);
        children.push(blockId);
        blocks.push(childBlock(message, blockId, 'raw', role, createdBy, message.content));
        links.push(link(id, blockId, 'contains', createdBy));
      }
      if (children.length > 0) block.children = children;
    }

    blocks.push(block);
    roots.push(id);

    const replyTo = message.parentId ?? (message.role === 'agent' ? lastUser : undefined);
    if (replyTo && ids.has(replyTo)) links.push(link(id, turnId(replyTo), 'responds-to', createdBy));
    if (message.role === 'user') lastUser = message.id;

    for (const target of message.supports)
      if (ids.has(target)) links.push(link(id, turnId(target), 'supports', createdBy));
    for (const target of message.contradicts)
      if (ids.has(target)) links.push(link(id, turnId(target), 'contradicts', createdBy));
    for (const target of message.derivesFrom)
      if (ids.has(target)) links.push(link(id, turnId(target), 'derived-from', createdBy));
  }

  const blockIds = new Set(blocks.map((b) => b.id));
  for (const message of messages) {
    for (const target of message.contexts ?? []) {
      if (blockIds.has(target)) {
        links.push(link(turnId(message.id), target, 'references', ROLE_MAP[message.role].createdBy));
      }
    }
  }

  return { blocks, links, roots };
}

/** Determine the block kind for a reasoning node based on its type and punctuation. */
function blockKindForNode(node: BackendNode, vocab: BackendVocabulary): BlockKind {
  const baseKind = vocab.nodes[node.kind] ?? 'claim';
  // For NAR concepts, punctuation indicates belief/goal/question/command
  if (node.kind === 'nar:concept') {
    const punctuation = (node.attrs as Record<string, unknown>)?.punctuation as string | undefined;
    const taskType = punctuation ? taskTypeForPunctuation(punctuation) : null;
    if (taskType === 'question') return 'question';
    if (taskType === 'goal') return 'claim'; // goals render as claims with goal role
    if (taskType === 'command') return 'command';
    // Default belief → claim
  }
  return baseKind;
}

/**
 * Project a reasoning backend's substrate into claim/tool blocks with
 * provenance links. Everything engine-specific — which node kind is a claim,
 * which edge kind is a derivation, what the truth values are called — arrives
 * through the adapter's vocabulary; an unmapped kind degrades to the generic
 * `claim`/`references` pair rather than disappearing.
 */
export function projectReasoning(
  backend: ReasoningBackend,
  exclude: ReadonlySet<Ref> = new Set()
): WorkspaceFragment {
  const { nodes, edges } = backend.snapshot();
  const { nodes: nodeKinds, edges: edgeKinds } = backend.vocab;

  const blocks: SemanticBlock[] = [];
  const links: SemanticLink[] = [];
  const roots: Ref[] = [];

  for (const id of [...nodes.keys()].sort()) {
    if (exclude.has(id)) continue;
    const node = nodes.get(id);
    if (!node) continue;
    const kind = blockKindForNode(node, backend.vocab);
    const blockId = claimId(id);
    const isToolCall = node.kind === 'metta:skill';
    blocks.push({
      id: blockId,
      kind,
      role: isToolCall ? 'tool' : 'reasoner',
      title: node.label,
      text: node.text,
      data: node.attrs,
      uncertainty: node.uncertainty,
      status: 'complete',
      createdAt: node.occurredAt ?? 0,
      createdBy: 'reasoner',
    });
    roots.push(blockId);
  }

  const blockIds = new Set(blocks.map((block) => block.id));
  const steps: SemanticBlock[] = [];
  const nesting = new Map<Ref, Ref[]>();

  for (const [id, edge] of [...edges.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const source = claimId(edge.source);
    const target = claimId(edge.target);
    if (!blockIds.has(source) || !blockIds.has(target)) continue;
    const kind = edgeKinds[edge.kind] ?? 'references';
    links.push({
      id: linkId(source, target, kind),
      source,
      target,
      kind,
      confidence: edge.confidence,
      eventRefs: id ? [id] : undefined,
      createdBy: 'reasoner',
    });
    // A provenance step is a fact *about* the derivation, not just a line between two
    // claims, so it gets its own block nested under the conclusion it justifies: the
    // notebook can fold it, the graph can select it, and the record renders through
    // the one view contract like any other artifact.
    if (linkMeta(kind).category === 'provenance') {
      const premise = nodes.get(edge.source);
      const conclusion = nodes.get(edge.target);
      const step = derivationId(id);
      steps.push({
        id: step,
        kind: 'derivation',
        role: 'reasoner',
        title: `${linkMeta(kind).label} · ${premise?.label ?? edge.source}`,
        data: {
          rule: kind,
          premises: [source],
          conclusion: target,
          confidence: edge.confidence,
          truth: conclusion?.uncertainty,
          events: id ? [id] : [],
          raw: { rule: edge.kind, premise: premise?.attrs, conclusion: conclusion?.attrs },
        },
        uncertainty: conclusion?.uncertainty,
        status: 'complete',
        createdAt: conclusion?.occurredAt ?? 0,
        createdBy: 'reasoner',
      });
      nesting.set(target, [...(nesting.get(target) ?? []), step]);
    }
  }

  const nested = blocks.map((block) => {
    const children = nesting.get(block.id);
    return children ? { ...block, children } : block;
  });

  return { blocks: [...nested, ...steps], links, roots };
}

/**
 * Project cognitive events into budget and gate-decision blocks.
 * Events projected:
 * - budget.exhausted → budget blocks
 * - policy.violation / egress.gate.rejected / shadow.validation.dropped / judgment.resolved → gate-decision blocks
 */
export function projectCognitiveEvents(events: readonly CognitiveEvent[]): WorkspaceFragment {
  const blocks: SemanticBlock[] = [];
  const links: SemanticLink[] = [];
  const roots: Ref[] = [];

  for (const event of events) {
    switch (event.type) {
      case 'budget.exhausted': {
        const id = `event:budget:${event.correlationId ?? event.timestamp}`;
        blocks.push({
          id,
          kind: 'budget',
          role: 'system',
          title: `Budget exhausted: ${event.payload.budgetType}`,
          text: `Budget type: ${event.payload.budgetType}, remaining: ${event.payload.remaining}/${event.payload.limit}, reason: ${event.payload.terminationReason}`,
          data: event.payload,
          status: 'complete',
          createdAt: event.timestamp,
          createdBy: 'system',
          eventRefs: [event.correlationId ?? ''],
        });
        roots.push(id);
        break;
      }
      case 'policy.violation': {
        const id = `event:policy:${event.correlationId ?? event.timestamp}`;
        blocks.push({
          id,
          kind: 'gate-decision',
          role: 'system',
          title: `Policy violation: ${event.payload.violationType}`,
          text: `Policy: ${event.payload.policyId}, type: ${event.payload.violationType}, severity: ${event.payload.severity}, detail: ${event.payload.detail}`,
          data: event.payload,
          status: 'complete',
          createdAt: event.timestamp,
          createdBy: 'system',
          eventRefs: [event.correlationId ?? ''],
        });
        roots.push(id);
        break;
      }
      case 'egress.gate.rejected': {
        const id = `event:egress:${event.correlationId ?? event.timestamp}`;
        blocks.push({
          id,
          kind: 'gate-decision',
          role: 'system',
          title: `Egress gate rejected: ${event.payload.gate}`,
          text: `Gate: ${event.payload.gate}, score: ${event.payload.score ?? 'N/A'}, detail: ${event.payload.detail ?? 'N/A'}`,
          data: event.payload,
          status: 'complete',
          createdAt: event.timestamp,
          createdBy: 'system',
          eventRefs: [event.correlationId ?? ''],
        });
        roots.push(id);
        break;
      }
      case 'shadow.validation.dropped': {
        const id = `event:shadow:${event.correlationId ?? event.timestamp}`;
        blocks.push({
          id,
          kind: 'gate-decision',
          role: 'system',
          title: `Shadow validation dropped: ${event.payload.conflictType}`,
          text: `Candidate: ${event.payload.candidateTerm}, source: ${event.payload.source}, conflict: ${event.payload.conflictType}${event.payload.frequencyDelta ? `, freqDelta: ${event.payload.frequencyDelta}` : ''}${event.payload.semanticScore ? `, semanticScore: ${event.payload.semanticScore}` : ''}`,
          data: event.payload,
          status: 'complete',
          createdAt: event.timestamp,
          createdBy: 'system',
          eventRefs: [event.correlationId ?? ''],
        });
        roots.push(id);
        break;
      }
      case 'judgment.resolved': {
        const id = `event:judgment:${event.correlationId ?? event.timestamp}`;
        blocks.push({
          id,
          kind: 'gate-decision',
          role: 'system',
          title: `Judgment resolved: ${event.payload.shape}`,
          text: `Query: ${event.payload.queryId}, axis: ${event.payload.axis}, tier: ${event.payload.tier}, latency: ${event.payload.latencyMs}ms, abstained: ${event.payload.abstained}`,
          data: event.payload,
          status: 'complete',
          createdAt: event.timestamp,
          createdBy: 'system',
          eventRefs: [event.correlationId ?? ''],
        });
        roots.push(id);
        break;
      }
    }
  }

  return { blocks, links, roots };
}

const merge = (fragments: readonly WorkspaceFragment[]): WorkspaceGraph => {
  const graph: WorkspaceGraph = { blocks: new Map(), links: new Map(), roots: [], selection: new Set() };
  for (const fragment of fragments) {
    for (const block of fragment.blocks) graph.blocks.set(block.id, block);
    for (const link of fragment.links) graph.links.set(link.id, link);
    graph.roots.push(...fragment.roots.filter((id) => !graph.roots.includes(id)));
  }
  return graph;
};

/** Project the whole current client state into one WorkspaceGraph. */
export function projectWorkspace(state: {
  messages: readonly ChatMessage[];
  backend: ReasoningBackend;
  cognitiveEvents?: readonly CognitiveEvent[];
}): WorkspaceGraph {
  const messageIds = new Set(state.messages.map((message) => message.id));
  const fragments = [projectChat(state.messages), projectReasoning(state.backend, messageIds)];
  if (state.cognitiveEvents && state.cognitiveEvents.length > 0) {
    fragments.push(projectCognitiveEvents(state.cognitiveEvents));
  }
  return merge(fragments);
}

/**
 * The block a reasoning node id projects to, or `undefined` when the backend
 * does not carry that node. This is the **node→block mapping** (§2.4): the engine
 * speaks node ids, the substrate speaks block refs, and the projection is the one
 * place that derives one from the other — so the inspector, the graph menu and the
 * ToC resolve a selection through it instead of inventing ids of their own.
 */
export const blockRefFor = (backend: ReasoningBackend, id: Ref): Ref | undefined =>
  backend.snapshot().nodes.has(id) ? claimId(id) : undefined;

/**
 * The link an engine edge id projects to, or `undefined` when the backend does
 * not carry that edge. The edge half of the node→block mapping (§2.4): the link
 * ref is derived from both endpoints *and* the backend's edge vocabulary, so it
 * can only be minted here.
 */
export const linkRefFor = (backend: ReasoningBackend, id: Ref): Ref | undefined => {
  const edge = backend.snapshot().edges.get(id);
  return edge
    ? linkId(
        claimId(edge.source),
        claimId(edge.target),
        backend.vocab.edges[edge.kind] ?? 'references'
      )
    : undefined;
};

/**
 * The block ref a graph element id names. The substrate is the authority: an id
 * the graph already carries *is* a ref (a conversation node's id is its block's),
 * and only an engine id goes through the backend's mapping — so a surface can
 * take whatever id the graph layer handed it and still reach the same block.
 */
export const resolveBlockRef = (
  graph: WorkspaceGraph,
  backend: ReasoningBackend,
  id: Ref
): Ref | undefined => (graph.blocks.has(id) ? id : blockRefFor(backend, id));

