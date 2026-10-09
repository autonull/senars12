import type { GraphNodeData } from '@senars/core';
import { describe, expect, it } from 'vitest';
import { narsBackend } from '../../src/client/core/nars-backend.js';
import type {
  BackendEdge,
  BackendNode,
  ReasoningBackend,
} from '../../src/client/core/reasoning-backend.js';
import { $graphEdges, $graphNodes } from '../../src/client/core/store.js';
import { payloadOf } from '../../src/client/core/block-payload.js';
import {
  blockRefFor,
  claimId,
  derivationId,
  projectReasoning,
  projectWorkspace,
  resolveBlockRef,
} from '../../src/client/core/workspace-projection.js';

const engine = (
  nodes: GraphNodeData[] = [],
  edges: [string, Record<string, unknown>][] = []
): void => {
  $graphNodes.set(new Map(nodes.map((node) => [node.id as string, node])));
  $graphEdges.set(new Map(edges));
};

const node = (id: string, over: Partial<GraphNodeData> = {}): GraphNodeData => ({
  id,
  term: id,
  nodeType: 'nar:concept',
  ...over,
});

const backendNode = (id: string, kind: string, extra: Partial<BackendNode> = {}): BackendNode => ({
  id,
  kind,
  label: id,
  attrs: { id },
  ...extra,
});

/** A second adapter over a different engine: it declares its own kinds and truth. */
const mettaBackend = (
  nodes: readonly BackendNode[],
  edges: readonly BackendEdge[] = []
): ReasoningBackend => ({
  id: 'metta',
  kind: 'proof-checked',
  vocab: { nodes: { proposition: 'claim', question: 'question' }, edges: { entails: 'supports' } },
  snapshot: () => ({
    nodes: new Map(nodes.map((n) => [n.id, n])),
    edges: new Map(edges.map((e) => [e.id, e])),
  }),
});

describe('nars adapter', () => {
  it('normalizes engine records into the substrate contract, keeping attrs verbatim', () => {
    const bird = node('bird', { label: 'Birds fly', truth: { frequency: 0.9, confidence: 0.8 } });
    engine(
      [bird],
      [
        [
          'e1',
          { source: 'bird', target: 'sky', type: 'derivation', confidence: 0.7, rule: 'deduction' },
        ],
      ]
    );
    const { nodes, edges } = narsBackend.snapshot();
    expect(nodes.get('bird')).toMatchObject({
      kind: 'nar:concept',
      label: 'Birds fly',
      text: 'bird',
      uncertainty: { frequency: 0.9, confidence: 0.8, vocabulary: 'nal' },
    });
    expect(nodes.get('bird')?.attrs).toBe(bird);
    expect(edges.get('e1')).toMatchObject({ kind: 'derivation', confidence: 0.7 });
  });

  it('falls back label→term→atom→id and keeps only a numeric confidence', () => {
    engine(
      [
        { id: 'a', atom: '(cat)', nodeType: 'metta:atom' },
        { id: 'b', nodeType: 'nar:concept' },
      ],
      [['e1', { source: 'a', target: 'b', type: 'reference', confidence: 'high' }]]
    );
    const { nodes, edges } = narsBackend.snapshot();
    expect(nodes.get('a')).toMatchObject({ label: '(cat)', text: '(cat)' });
    expect(nodes.get('b')).toMatchObject({ label: 'b', text: undefined });
    expect(edges.get('e1')?.confidence).toBeUndefined();
  });

  it('reuses the snapshot while the engine maps are unchanged', () => {
    engine([node('a')]);
    const first = narsBackend.snapshot();
    expect(narsBackend.snapshot()).toBe(first);
    engine([node('a'), node('b')]);
    expect(narsBackend.snapshot()).not.toBe(first);
  });
});

describe('node→block mapping', () => {
  it('resolves a carried node and refuses one the backend does not have', () => {
    engine([node('bird')]);
    expect(blockRefFor(narsBackend, 'bird')).toBe(claimId('bird'));
    expect(blockRefFor(narsBackend, 'ghost')).toBeUndefined();
  });

  it('follows whichever backend is passed', () => {
    const backend = mettaBackend([backendNode('p', 'proposition')]);
    expect(projectReasoning(backend).blocks.map((block) => block.id)).toEqual([
      blockRefFor(backend, 'p'),
    ]);
    expect(blockRefFor(narsBackend, 'p')).toBeUndefined();
  });

  it('resolves whatever id a graph element carries', () => {
    engine([node('bird')]);
    const graph = projectWorkspace({ messages: [], backends: [narsBackend] });
    // a conversation node's id is already a block ref; an engine id maps through the backend
    expect(resolveBlockRef(graph, narsBackend, claimId('bird'))).toBe(claimId('bird'));
    expect(resolveBlockRef(graph, narsBackend, 'bird')).toBe(claimId('bird'));
    expect(resolveBlockRef(graph, narsBackend, 'ghost')).toBeUndefined();
  });
});

describe('derivation records', () => {
  /** Two claims the engine linked with a rule it names `entails`, which this backend's vocabulary reads as a derivation. */
  const deriving = () =>
    projectReasoning({
      id: 'metta',
      kind: 'proof-checked',
      vocab: { nodes: { proposition: 'claim' }, edges: { entails: 'derived-from' } },
      snapshot: () => ({
        nodes: new Map([
          ['fly', backendNode('fly', 'proposition', { attrs: { id: 'fly', truth: 'yes' } })],
          ['up', backendNode('up', 'proposition')],
        ]),
        edges: new Map([
          ['e1', { id: 'e1', source: 'fly', target: 'up', kind: 'entails', confidence: 0.75 }],
        ]),
      }),
    });

  it('documents a provenance edge as its own record, nested under the conclusion', () => {
    const fragment = deriving();
    const conclusion = fragment.blocks.find((block) => block.id === claimId('up'));
    expect(conclusion?.children).toEqual([derivationId('e1')]);

    const record = fragment.blocks.find((block) => block.kind === 'derivation');
    expect(record?.id).toBe(derivationId('e1'));
    expect(record?.uncertainty).toBeUndefined();
    expect(payloadOf(record?.data, 'derivation')).toMatchObject({
      rule: 'derived-from',
      premises: [claimId('fly')],
      conclusion: claimId('up'),
      confidence: 0.75,
      events: ['e1'],
    });
    // the engine's own record is kept, not reinterpreted
    expect(payloadOf(record?.data, 'derivation')?.raw).toMatchObject({
      rule: 'entails',
      premise: { id: 'fly' },
      conclusion: { id: 'up' },
    });
  });

  it('leaves an edge that is not a provenance step without a record', () => {
    const fragment = projectReasoning(
      mettaBackend(
        [backendNode('a', 'proposition'), backendNode('b', 'proposition')],
        [{ id: 'e2', source: 'a', target: 'b', kind: 'supports' }]
      )
    );
    expect(fragment.blocks.some((block) => block.kind === 'derivation')).toBe(false);
    expect(fragment.blocks.find((block) => block.id === claimId('b'))?.children).toBeUndefined();
  });
});

describe('backend-agnostic projection', () => {
  it('resolves a second engine through its own vocabulary and truth label', () => {
    const fragment = projectReasoning(
      mettaBackend([
        backendNode('p', 'proposition', {
          uncertainty: { frequency: 1, confidence: 1, vocabulary: 'proof-checked' },
        }),
        backendNode('q', 'question'),
        backendNode('s', 'strange'),
      ])
    );
    expect(fragment.blocks.map((block) => block.kind)).toEqual(['claim', 'question', 'claim']);
    expect(fragment.blocks[0].uncertainty).toEqual({
      frequency: 1,
      confidence: 1,
      vocabulary: 'proof-checked',
    });
  });

  it('maps known edge kinds, degrades unknown ones, and honours the exclusion set', () => {
    const fragment = projectReasoning(
      mettaBackend(
        [backendNode('p', 'proposition'), backendNode('q', 'question')],
        [
          { id: 'e1', source: 'q', target: 'p', kind: 'entails' },
          { id: 'e2', source: 'q', target: 'p', kind: 'mystery' },
        ]
      )
    );
    expect(fragment.links.map((link) => link.kind)).toEqual(['supports', 'references']);
    expect(fragment.links[0].id).toContain(claimId('p'));

    const excluded = projectReasoning(
      mettaBackend(
        [backendNode('p', 'proposition')],
        [{ id: 'e1', source: 'p', target: 'p', kind: 'entails' }]
      ),
      new Set(['p'])
    );
    expect(excluded.blocks).toHaveLength(0);
    expect(excluded.links).toHaveLength(0);
  });
});
