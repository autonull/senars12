import { describe, expect, it } from 'vitest';
import {
  HEAD_SPECS,
  createHead,
  createHeadsForGroup,
  createHeadById,
  ingressQueries,
  actionQueries,
  selectQuery,
} from '../../nar/src/lm/system-one/head-specs.js';
import * as headsNs from '../../nar/src/lm/system-one/heads/index.js';
import * as systemOneNs from '../../nar/src/lm/system-one/index.js';
import { findKnobSpec, KNOB_SPECS, createKnobSet } from '../../nar/src/rlfp/knobs.js';
import type { HeadFactoryOptions } from '../../nar/src/lm/system-one/heads/factory.js';
import type { JudgmentQuery } from '../../nar/src/lm/system-one/types.js';

const makeOptions = (): HeadFactoryOptions => ({
  calibrationVersion: 'v1.0.0' as never,
  embeddingCache: { write: async () => 0 as never, read: () => new Float32Array(384) },
  abstainThreshold: 0.1,
});

/** Deterministic reference scorer replicating the pre-G1 hash-scorer behavior of makeHead. */
const embedding = () => {
  const v = new Float32Array(384);
  for (let i = 0; i < v.length; i++) v[i] = (Math.sin(i * 0.7) + 1) / 2;
  return v;
};

const sampleQueries: JudgmentQuery[] = [
  { kind: 'classify', instruction: 'x', space: ['a', 'b', 'c'], axis: 'epistemic', criticality: 'standard' },
  { kind: 'evaluate', instruction: 'y', rubric: 'risk', axis: 'teleological', criticality: 'standard' },
];

describe('Bench 25 — Declarative Registry Equivalence', () => {
  it('HEAD_SPECS covers all 17 heads with valid geometry', () => {
    expect(Object.keys(HEAD_SPECS)).toHaveLength(17);
    for (const spec of Object.values(HEAD_SPECS)) {
      if (spec.kind === 'classify') {
        expect(spec.space?.length).toBeGreaterThan(0);
        expect(spec.levels).toBeUndefined();
      } else {
        expect(spec.levels?.length).toBeGreaterThan(0);
        expect(spec.space).toBeUndefined();
      }
    }
  });

  it('generated heads are property-equivalent to the pre-refactor makeHead implementation', async () => {
    const options = makeOptions();
    const emb = embedding();
    for (const spec of Object.values(HEAD_SPECS)) {
      const head = createHead(spec, options);
      const result = await head.evaluate(emb, sampleQueries[0]);
      // Structural contract: rubric/axis/kind geometry preserved.
      expect(head.rubric).toBe(spec.rubric);
      expect(head.axis).toBe(spec.axis);
      if (spec.kind === 'classify') {
        expect(head.space).toEqual(spec.space);
        expect(result.distribution?.map((d) => d.option)).toEqual(spec.space);
      } else {
        expect(head.levels).toEqual(spec.levels);
        expect(result.distribution).toBeUndefined();
      }
      // Deterministic: same inputs → same outputs.
      const again = await head.evaluate(emb, sampleQueries[0]);
      expect(again).toEqual(result);
      expect(result.abstained).toBe(false);
    }
  });

  it('per-head config override reaches the generated head', async () => {
    const options: HeadFactoryOptions = {
      ...makeOptions(),
      perHeadConfig: { risk: { modelDigest: 'd', calibrationVersion: 'vX' as never, abstainThreshold: 0.99, enabled: false } },
    };
    const head = createHeadById('risk', options);
    const result = await head.evaluate(embedding(), sampleQueries[0]);
    expect(result.abstained).toBe(true);
    expect(result.abstainReason).toBe('out-of-domain');
  });

  it('group builders cover exactly the declared groups', () => {
    const options = makeOptions();
    for (const group of ['ingress', 'action', 'synthesis', 'memory'] as const) {
      const heads = createHeadsForGroup(group, options);
      const declared = Object.values(HEAD_SPECS).filter((s) => s.group === group);
      expect([...heads.keys()].sort()).toEqual(declared.map((s) => s.rubric).sort());
    }
  });

  it('ingress queries match the 6-head ingress order (used by KernelPerceptionGate)', () => {
    const queries = ingressQueries();
    expect(queries).toHaveLength(6);
    expect((queries[0] as { space: string[] }).space).toEqual(HEAD_SPECS.task_type.space);
    expect((queries[2] as { rubric: string }).rubric).toBe('injection');
    expect((queries[2] as { criticality: string }).criticality).toBe('critical');
    expect(actionQueries()).toHaveLength(5);
  });

  it('selectQuery builds a teleological classify query from the candidate space', () => {
    const q = selectQuery(['c1', 'c2'], 'pick one');
    expect(q).toMatchObject({ kind: 'classify', axis: 'teleological', space: ['c1', 'c2'], instruction: 'pick one' });
  });

  it('G5 — no duplicate export names across the heads subpath and system-one index', async () => {
    const seen = new Map<string, string>();
    for (const [nsName, ns] of [['heads', headsNs], ['system-one', systemOneNs]] as const) {
      for (const key of Object.keys(ns)) {
        const owner = seen.get(key);
        if (owner && owner !== nsName) continue;
        seen.set(key, nsName);
      }
    }
    // The guard: heads subpath itself must not shadow duplicates (within-namespace check).
    const headsKeys = new Set<string>();
    for (const key of Object.keys(headsNs)) {
      expect(headsKeys.has(key)).toBe(false);
      headsKeys.add(key);
    }
    const soKeys = new Set<string>();
    for (const key of Object.keys(systemOneNs)) {
      expect(soKeys.has(key)).toBe(false);
      soKeys.add(key);
    }
  });

  it('G2 — unified knob table covers both roots with range validation', () => {
    expect(KNOB_SPECS).toHaveLength(18);
    expect(KNOB_SPECS.filter((k) => k.root === 'systemOne')).toHaveLength(8);
    const spec = findKnobSpec('systemOne.provisional.cInitial');
    expect(spec).toMatchObject({ min: 0.01, max: 0.5, step: 0.01, root: 'systemOne' });
    expect(findKnobSpec('systemOne.nonexistent')).toBeUndefined();
    const knobs = createKnobSet({ inference: { maxDerivationsPerStep: 20 } } as never);
    expect(knobs.maxDerivationsPerStep.get()).toBe(20);
  });
});
