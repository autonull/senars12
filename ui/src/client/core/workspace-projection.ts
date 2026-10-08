/**
 * Projection from the current client state into the WorkspaceGraph (§0.2). The
 * chat log projects to ordered `turn` blocks with `responds-to`/`supports`/
 * `contradicts`/`derived-from` discourse links; the engine graph projects to
 * `claim` blocks with `derived-from`/`references` links and engine uncertainty.
 * The projection is deterministic (stable ids, sorted graph blocks), so a
 * streaming reparse yields identical blocks and the existing graph/event
 * behavior is preserved rather than re-owned.
 */

import type { ChatMessage, GraphNodeData } from '@senars/core';
import { decomposeForMode, DEFAULT_COMPOSER_MODE, isComposerMode } from './composer-modes.js';
import { isFaithfulDecomposition } from './input-decomposition.js';
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
  truth ? { frequency: truth.frequency, confidence: truth.confidence, vocabulary: 'nal' } : undefined;

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

  return { blocks, links, roots };
}

const NODE_KINDS: Record<GraphNodeData['nodeType'], BlockKind> = {
  'nar:concept': 'claim',
  'metta:atom': 'claim',
  'metta:skill': 'tool-call',
};

const EDGE_KINDS: Record<string, SemanticLinkKind> = {
  derivation: 'derived-from',
  support: 'supports',
  contradiction: 'contradicts',
  revision: 'revises',
  reference: 'references',
};

/** Project the engine graph into claim/tool blocks with provenance and reference links. */
export function projectGraph(
  nodes: ReadonlyMap<Ref, GraphNodeData>,
  edges: ReadonlyMap<Ref, Record<string, unknown>>,
  exclude: ReadonlySet<Ref> = new Set()
): WorkspaceFragment {
  const blocks: SemanticBlock[] = [];
  const links: SemanticLink[] = [];
  const roots: Ref[] = [];

  for (const id of [...nodes.keys()].sort()) {
    if (exclude.has(id)) continue;
    const node = nodes.get(id);
    if (!node) continue;
    const kind = NODE_KINDS[node.nodeType] ?? 'claim';
    const blockId = claimId(id);
    blocks.push({
      id: blockId,
      kind,
      role: kind === 'tool-call' ? 'tool' : 'reasoner',
      title: node.label ?? node.term ?? node.atom ?? id,
      text: node.term ?? node.atom,
      data: node,
      uncertainty: uncertaintyFrom(node.truth),
      status: 'complete',
      createdAt: 0,
      createdBy: 'reasoner',
    });
    roots.push(blockId);
  }

  const blockIds = new Set(blocks.map((block) => block.id));
  for (const [id, edge] of [...edges.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const source = claimId(String(edge.source));
    const target = claimId(String(edge.target));
    if (!blockIds.has(source) || !blockIds.has(target)) continue;
    const kind: SemanticLinkKind = EDGE_KINDS[String(edge.type)] ?? 'references';
    links.push({
      id: linkId(source, target, kind),
      source,
      target,
      kind,
      confidence: typeof edge.confidence === 'number' ? edge.confidence : undefined,
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
  nodes: ReadonlyMap<Ref, GraphNodeData>;
  edges: ReadonlyMap<Ref, Record<string, unknown>>;
}): WorkspaceGraph {
  const messageIds = new Set(state.messages.map((message) => message.id));
  return merge([projectChat(state.messages), projectGraph(state.nodes, state.edges, messageIds)]);
}
