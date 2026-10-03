import { describe, expect, it } from 'vitest';
import {
  CYCLE_PATH_PREFIXES,
  IN_CYCLE_EDGE_ATTRIBUTIONS,
  IN_CYCLE_INVENTORY,
} from '../../nar/src/lm/in-cycle-inventory.js';
import { PROVIDER_SEAMS } from '../../nar/src/lm/provider-seams.js';
import {
  checkInventory,
  type DiscoveredEdge,
  isTypeOnlyImport,
  lineOf,
} from '../../scripts/lib/induction-inventory.js';
import { checkSeams } from '../../scripts/lib/provider-dependency.js';
import { type WitnessList, witnessFiles, witnessHolds } from '../../util/src/index.js';

/**
 * TODO29.a A0 — the two gates' rules, and the declarations they read.
 *
 * Both gates assert that a declaration is *true*, which is only worth anything
 * if a false declaration fails. So each rule gets its failure case here first,
 * and the committed data gets the consistency the scripts depend on — a seam
 * naming a behaviour the inventory does not declare is two documents about the
 * same cycle that disagree silently.
 */

describe('TODO29.a — seam declarations must be true', () => {
  const kinds = (declarations: Parameters<typeof checkSeams>[0], blocks: boolean) =>
    checkSeams(
      declarations,
      declarations.map((d) => ({ id: d.id, entered: true, blocks }))
    ).map((failure) => failure.kind);

  it('fails a seam declared bounded that a hanging provider blocks', () => {
    expect(kinds([{ id: 'a', bounded: true }], true)).toEqual(['unbounded-claim']);
  });

  it('passes a seam declared bounded that a hanging provider does not block', () => {
    expect(kinds([{ id: 'a', bounded: true }], false)).toEqual([]);
  });

  it('passes a seam declared unbounded that a hanging provider blocks', () => {
    expect(kinds([{ id: 'a', bounded: false }], true)).toEqual([]);
  });

  it('fails a seam declared unbounded that a hanging provider does not block', () => {
    expect(kinds([{ id: 'a', bounded: false }], false).includes('probe-observed-nothing')).toBe(
      true
    );
  });

  it('fails a probe that never reached the await, whatever it observed', () => {
    expect(
      checkSeams([{ id: 'a', bounded: false }], [{ id: 'a', entered: false, blocks: true }])
    ).toEqual([expect.objectContaining({ kind: 'probe-never-entered', seam: 'a' })]);
  });

  it('fails a declared seam nothing drives, and a probe nothing declares', () => {
    expect(checkSeams([{ id: 'a', bounded: false }], []).map((f) => f.kind)).toEqual([
      'unprobed-seam',
    ]);
    expect(checkSeams([], [{ id: 'a', entered: true, blocks: true }]).map((f) => f.kind)).toEqual([
      'probe-without-seam',
    ]);
  });
});

describe('TODO29.a — the inventory must account for the cycle path', () => {
  const edge = (file: string, typeOnly = false): DiscoveredEdge => ({
    file,
    specifier: '../lm/lm-service.js',
    typeOnly,
    line: 2,
  });

  const check = (subject: {
    edges?: readonly DiscoveredEdge[];
    attributions?: readonly { file: string; behaviour: string }[];
    cyclePathFiles?: readonly string[];
    sources?: Record<string, string>;
    callSites?: WitnessList;
  }) =>
    checkInventory({
      edges: subject.edges ?? [],
      behaviours: [{ id: 'known' }],
      attributions: subject.attributions ?? [],
      cyclePathFiles: subject.cyclePathFiles ?? [],
      sources: new Map(Object.entries(subject.sources ?? {})),
      callSites: subject.callSites ?? [],
    }).map((failure) => failure.kind);

  it('fails a value import from the cycle path that no behaviour owns', () => {
    expect(
      check({ edges: [edge('nar/src/rules/x.ts')], cyclePathFiles: ['nar/src/rules/x.ts'] })
    ).toEqual(['unattributed-cycle-import']);
  });

  it('accepts a type import, and one from outside the cycle path', () => {
    expect(
      check({
        edges: [edge('nar/src/rules/x.ts', true), edge('nar/src/agent/y.ts')],
        cyclePathFiles: ['nar/src/rules/x.ts'],
      })
    ).toEqual([]);
  });

  it('accepts a value import a declared behaviour owns', () => {
    expect(
      check({
        edges: [edge('nar/src/rules/x.ts')],
        attributions: [{ file: 'nar/src/rules/x.ts', behaviour: 'known' }],
        cyclePathFiles: ['nar/src/rules/x.ts'],
      })
    ).toEqual([]);
  });

  it('fails an attribution to a behaviour the inventory does not declare', () => {
    expect(
      check({
        attributions: [{ file: 'nar/src/rules/x.ts', behaviour: 'ghost' }],
        cyclePathFiles: ['nar/src/rules/x.ts'],
      })
    ).toEqual(['unaccounted-seam-behaviour']);
  });

  it('fails an attribution to a file that no longer imports the layer', () => {
    expect(
      check({
        attributions: [{ file: 'nar/src/rules/x.ts', behaviour: 'known' }],
        cyclePathFiles: [],
      })
    ).toEqual(['unattributed-behaviour']);
  });

  it('fails a call site whose file no longer holds the call', () => {
    expect(
      check({ callSites: [{ file: 'a.ts', contains: 'await x(' }], sources: { 'a.ts': 'a\nb\nc' } })
    ).toEqual(['dead-call-site']);
  });

  it('fails a call site whose file is gone', () => {
    expect(check({ callSites: [{ file: 'gone.ts', contains: 'await x(' }] })).toEqual([
      'dead-call-site',
    ]);
  });

  it('fails a call site that names no text to hold', () => {
    expect(
      check({ callSites: [{ file: 'a.ts', contains: '' }], sources: { 'a.ts': 'await x()' } })
    ).toEqual(['dead-call-site']);
  });

  it('accepts a call site wherever in the file the call has moved to', () => {
    expect(
      check({
        callSites: [{ file: 'a.ts', contains: 'await x(' }],
        sources: { 'a.ts': 'a\nb\nc\nd\nawait x()' },
      })
    ).toEqual([]);
  });

  it('reads a call site and an offset the way a reader would', () => {
    expect(lineOf('a\nbb\nccc', 5)).toBe(3);
    expect(witnessHolds('a\nbb', 'b')).toBe(true);
    expect(witnessHolds(undefined, 'b')).toBe(false);
    expect(
      witnessFiles([
        { file: 'a.ts', contains: 'x' },
        { file: 'a.ts', contains: 'y' },
      ])
    ).toEqual(['a.ts']);
  });
});

describe('TODO29.a — type-only is a lexical question', () => {
  const at = (source: string): boolean => isTypeOnlyImport(source, 0);

  it('recognises every shape that binds only types', () => {
    expect(at(`import type { A } from './a.js';`)).toBe(true);
    expect(at(`import { type A, type B } from './a.js';`)).toBe(true);
    expect(at(`import { type A, b } from './a.js';`)).toBe(false);
    expect(at(`import Def, { type A } from './a.js';`)).toBe(false);
    expect(at(`import * as ns from './a.js';`)).toBe(false);
  });
});

describe('TODO29.a — the committed declarations hold together', () => {
  const ids = IN_CYCLE_INVENTORY.map((behaviour) => behaviour.id);

  it('names the behaviour of every seam', () => {
    for (const seam of PROVIDER_SEAMS) {
      expect(ids).toContain(seam.behaviour);
    }
  });

  it('says why each behaviour would be missed if it were lost', () => {
    for (const behaviour of IN_CYCLE_INVENTORY) {
      expect(behaviour.noticedBy.length).toBeGreaterThan(20);
    }
  });

  it('names a bound wherever a seam claims one', () => {
    for (const seam of PROVIDER_SEAMS.filter((candidate) => candidate.bounded)) {
      expect(seam.bound).toBeDefined();
    }
  });

  it('identifies every seam and behaviour uniquely', () => {
    expect(new Set(PROVIDER_SEAMS.map((seam) => seam.id)).size).toBe(PROVIDER_SEAMS.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('attributes only files the committed cycle path contains', () => {
    for (const attribution of IN_CYCLE_EDGE_ATTRIBUTIONS) {
      expect(CYCLE_PATH_PREFIXES.some((prefix) => attribution.file.startsWith(prefix))).toBe(true);
    }
  });
});
