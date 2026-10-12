import { describe, expect, it } from 'vitest';
import {
  BLOCK_DESCRIPTORS,
  BLOCK_KINDS,
  blockDescriptor,
  kindsWhere,
} from '../../src/client/core/block-descriptors.js';

const sorted = (kinds: readonly string[]): string[] => [...kinds].sort();

/**
 * The facet sets are the six partial maps and if-chains D1 collapsed. Asserting
 * them here pins the migration: a facet that silently loses a kind (or gains a
 * stray one) fails, not just the exhaustiveness the catalog already guarantees.
 */
const FACETS = {
  artifact: ['table', 'code', 'math', 'image', 'diagram', 'chart', 'citation', 'tool-result', 'derivation'],
  navigable: ['heading', 'claim', 'goal', 'question', 'answer', 'table', 'code', 'tool-call', 'tool-result', 'derivation', 'gate-decision', 'budget', 'error'],
  jsonPanel: ['gate-decision', 'budget', 'config-change', 'tool-call', 'tool-result'],
  container: ['turn', 'section', 'heading'],
  section: ['turn', 'section'],
} as const;

describe('block descriptors', () => {
  it('derives BlockKind from the catalog keys (one source)', () => {
    expect(sorted(BLOCK_KINDS)).toEqual(
      sorted([
        'turn', 'section', 'heading', 'paragraph', 'claim', 'goal', 'question', 'answer', 'list',
        'table', 'code', 'math', 'image', 'diagram', 'chart', 'citation', 'tool-call',
        'tool-result', 'derivation', 'derivation-record', 'gate-decision', 'budget',
        'command', 'config-change', 'error', 'raw',
      ])
    );
    expect(BLOCK_KINDS).toEqual(Object.keys(BLOCK_DESCRIPTORS.definition));
  });

  it('reads a descriptor by kind with a non-empty, distinct label', () => {
    for (const kind of BLOCK_KINDS) expect(blockDescriptor(kind).label.length).toBeGreaterThan(0);
    const labels = BLOCK_KINDS.map((kind) => blockDescriptor(kind).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(Object.entries(FACETS))('selects exactly the %s kinds', (facet, expected) => {
    const picked = kindsWhere((descriptor) => descriptor[facet as keyof typeof FACETS]);
    expect(sorted(picked)).toEqual(sorted(expected));
  });

  it('advertises every kind as graph-renderable (folds the stale GRAPH_BLOCK_KINDS)', () => {
    const graphKinds = kindsWhere((descriptor) => descriptor.graphRenderable);
    expect(sorted(graphKinds)).toEqual(sorted(BLOCK_KINDS));
    expect(graphKinds).toContain('derivation-record');
    expect(graphKinds).toContain('command');
  });
});
