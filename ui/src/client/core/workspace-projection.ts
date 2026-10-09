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

import type { ChatMessage } from '@senars/core';
import { decomposeForMode, DEFAULT_COMPOSER_MODE, isComposerMode } from './composer-modes.js';
import { isFaithfulDecomposition } from './input-decomposition.js';
import { NAL_VOCABULARY } from './nars-backend.js';
import type { ReasoningBackend } from './reasoning-backend.js';
import { segmentText } from './segmentation.js';
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
    const kind = nodeKinds[node.kind] ?? 'claim';
    const blockId = claimId(id);
    blocks.push({
      id: blockId,
      kind,
      role: kind === 'tool-call' ? 'tool' : 'reasoner',
      title: node.label,
      text: node.text,
      data: node.attrs,
      uncertainty: node.uncertainty,
      status: 'complete',
      createdAt: 0,
      createdBy: 'reasoner',
    });
    roots.push(blockId);
  }

  const blockIds = new Set(blocks.map((block) => block.id));
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
}): WorkspaceGraph {
  const messageIds = new Set(state.messages.map((message) => message.id));
  return merge([projectChat(state.messages), projectReasoning(state.backend, messageIds)]);
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

