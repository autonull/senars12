import type { ChatMessage, GraphNodeData } from '@senars/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { narsBackend } from '../../src/client/core/nars-backend.js';
import { mettaBackend } from '../../src/client/core/metta-backend.js';
import { $graphEdges, $graphNodes } from '../../src/client/core/store.js';
import {
  childId,
  claimId,
  linkId,
  projectChat,
  projectReasoning,
  projectWorkspace,
  rawChildId,
  turnId,
} from '../../src/client/core/workspace-projection.js';

const message = (over: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'role'>): ChatMessage => ({
  content: '',
  timestamp: 0,
  parentId: null,
  threadRootId: '',
  supports: [],
  contradicts: [],
  derivesFrom: [],
  ...over,
});

const node = (id: string, over: Partial<GraphNodeData> = {}): GraphNodeData => ({
  id,
  label: id,
  term: id,
  nodeType: 'nar:concept',
  ...over,
});

const must = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('expected a projected block');
  return value;
};

/** The engine graph the NARS adapter reads, written straight into the store atoms. */
const engine = (
  nodes: GraphNodeData[] = [],
  edges: [string, Record<string, unknown>][] = []
): void => {
  $graphNodes.set(new Map(nodes.map((node) => [node.id as string, node])));
  $graphEdges.set(new Map(edges));
};

beforeEach(() => engine());

describe('chat projection', () => {
  it('projects ordered turn blocks with mapped roles', () => {
    const fragment = projectChat([
      message({ id: 'u1', role: 'user', content: 'hi', timestamp: 1 }),
      message({ id: 'a1', role: 'agent', content: 'hello', timestamp: 2 }),
    ]);
    expect(fragment.roots).toEqual([turnId('u1'), turnId('a1')]);
    const user = must(fragment.blocks.find((b) => b.id === turnId('u1')));
    const agent = must(fragment.blocks.find((b) => b.id === turnId('a1')));
    expect(user).toMatchObject({ kind: 'turn', role: 'user' });
    expect(agent).toMatchObject({ kind: 'turn', role: 'assistant', createdBy: 'lm' });
    expect(agent.children).toEqual([childId('a1', 0)]);
    expect(must(fragment.blocks.find((b) => b.id === childId('a1', 0)))).toMatchObject({
      kind: 'paragraph',
      text: 'hello',
    });
  });

  it('segments agent output into child blocks linked by contains', () => {
    const fragment = projectChat([
      message({ id: 'a1', role: 'agent', content: '# Title\n\nbody\n\n- a\n- b' }),
    ]);
    const agent = must(fragment.blocks.find((b) => b.id === turnId('a1')));
    expect(agent.children).toHaveLength(3);
    expect(fragment.blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'list', 'turn']);
    const contains = fragment.links.filter((l) => l.kind === 'contains');
    expect(contains.map((l) => l.target)).toEqual(agent.children);
  });

  it('decomposes user input into claim/question children, adding a raw child when lossy', () => {
    const fragment = projectChat([
      message({ id: 'u1', role: 'user', content: 'A. B?', timestamp: 1 }),
    ]);
    const user = must(fragment.blocks.find((b) => b.id === turnId('u1')));
    expect(user.children).toEqual([childId('u1', 0), childId('u1', 1), rawChildId('u1')]);
    expect(fragment.blocks.find((b) => b.id === childId('u1', 0))).toMatchObject({
      kind: 'claim',
      text: 'A.',
    });
    expect(fragment.blocks.find((b) => b.id === childId('u1', 1))).toMatchObject({
      kind: 'question',
      text: 'B?',
    });
    expect(fragment.blocks.find((b) => b.id === rawChildId('u1'))?.text).toBe('A. B?');
  });

  it('keeps a single verbatim claim as the only child (raw lives on the turn)', () => {
    const fragment = projectChat([message({ id: 'u1', role: 'user', content: 'hello' })]);
    const user = must(fragment.blocks.find((b) => b.id === turnId('u1')));
    expect(user.children).toEqual([childId('u1', 0)]);
    expect(fragment.blocks.some((b) => b.kind === 'raw')).toBe(false);
  });

  it('reshapes a user turn to the declared composer mode', () => {
    const fragment = projectChat([
      message({ id: 'u1', role: 'user', content: 'Robins are birds.', mode: 'question' }),
      message({ id: 'u2', role: 'user', content: 'A. B.', mode: 'command' }),
    ]);
    expect(fragment.blocks.find((b) => b.id === childId('u1', 0))).toMatchObject({
      kind: 'question',
      text: 'Robins are birds.',
    });
    expect(fragment.blocks.find((b) => b.id === childId('u2', 0))).toMatchObject({
      kind: 'command',
      text: 'A. B.',
    });
  });

  it('falls back to the lexical split for an unknown carried mode', () => {
    const fragment = projectChat([
      message({ id: 'u1', role: 'user', content: 'A. B?', mode: 'telepathy' }),
    ]);
    expect(fragment.blocks.find((b) => b.id === childId('u1', 0))?.kind).toBe('claim');
  });

  it('references the block a turn follows up on, dropping unknown targets', () => {
    const fragment = projectChat([
      message({ id: 'u1', role: 'user', content: 'Robins are birds.' }),
      message({ id: 'u2', role: 'user', content: 'Why?', contexts: [childId('u1', 0)] }),
      message({ id: 'u3', role: 'user', content: 'And?', contexts: ['ghost'] }),
    ]);
    const references = fragment.links.filter((l) => l.kind === 'references');
    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({ source: turnId('u2'), target: childId('u1', 0) });
  });

  it('links an agent turn to the preceding user turn, or to an explicit parent', () => {
    const fragment = projectChat([
      message({ id: 'u1', role: 'user' }),
      message({ id: 'a1', role: 'agent' }),
      message({ id: 'a2', role: 'agent', parentId: 'u1' }),
    ]);
    const responds = fragment.links.filter((l) => l.kind === 'responds-to');
    expect(responds.map((l) => [l.source, l.target])).toEqual([
      [turnId('a1'), turnId('u1')],
      [turnId('a2'), turnId('u1')],
    ]);
  });

  it('projects epistemic references only when the target turn exists', () => {
    const fragment = projectChat([
      message({ id: 'u1', role: 'user' }),
      message({ id: 'a1', role: 'agent', supports: ['u1', 'ghost'], contradicts: ['u1'] }),
    ]);
    const kinds = fragment.links.map((l) => l.kind);
    expect(kinds).toContain('supports');
    expect(kinds).toContain('contradicts');
    expect(fragment.links.some((l) => l.target === turnId('ghost'))).toBe(false);
  });
});

describe('reasoning projection', () => {
  it('projects engine nodes to typed blocks with uncertainty', () => {
    engine([
      node('bird', { truth: { frequency: 0.9, confidence: 0.8 } }),
      node('skill:x', { nodeType: 'metta:skill' }),
    ]);
    const fragment = projectReasoning(narsBackend);
    const bird = must(fragment.blocks.find((b) => b.id === claimId('bird')));
    expect(bird.kind).toBe('claim');
    expect(bird.uncertainty).toEqual({ frequency: 0.9, confidence: 0.8, vocabulary: 'nal' });
    expect(fragment.blocks.find((b) => b.id === claimId('skill:x'))?.kind).toBe('tool-call');
  });

  it('projects derivations, unknown edges, and skips dangling endpoints', () => {
    engine(
      [node('a'), node('b')],
      [
        ['e1', { source: 'a', target: 'b', type: 'derivation' }],
        ['e2', { source: 'b', target: 'a', type: 'mystery', confidence: 0.3 }],
        ['e3', { source: 'a', target: 'ghost', type: 'derivation' }],
      ]
    );
    const fragment = projectReasoning(narsBackend);
    expect(fragment.links.map((l) => l.kind)).toEqual(['derived-from', 'references']);
    expect(fragment.links[1].confidence).toBe(0.3);
    expect(fragment.links).toHaveLength(2);
  });

  it('is deterministic under shuffled insertion order', () => {
    $graphNodes.set(
      new Map([
        ['b', node('b')],
        ['a', node('a')],
      ])
    );
    const a = projectReasoning(narsBackend);
    $graphNodes.set(
      new Map([
        ['a', node('a')],
        ['b', node('b')],
      ])
    );
    const b = projectReasoning(narsBackend);
    expect(a.roots).toEqual(b.roots);
    expect(a.roots).toEqual([claimId('a'), claimId('b')]);
  });
});

describe('workspace projection', () => {
  it('merges chat and reasoning, excluding nodes that are chat messages', () => {
    const messages = [message({ id: 'u1', role: 'user' }), message({ id: 'm1', role: 'agent' })];
    engine([node('m1'), node('bird')]);
    const graph = projectWorkspace({ messages, backends: [narsBackend] });
    expect(graph.roots).toEqual([turnId('u1'), turnId('m1'), claimId('bird')]);
    expect(graph.blocks.has(claimId('m1'))).toBe(false);
  });

  it('uses stable namespaced ids', () => {
    expect(turnId('x')).toBe('turn:x');
    expect(claimId('x')).toBe('claim:x');
    expect(linkId('a', 'b', 'supports')).toBe('link:a->b:supports');
  });
});
