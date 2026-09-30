import { cognitiveBounds, narCoreBounds } from '@senars/util/config';
import { describe, expect, it } from 'vitest';

/**
 * `narCoreBounds` and `cognitiveBounds` are two bound tables for the same engine,
 * and both docblocks call themselves the single source of truth for the engine
 * defaults, the config-file schema and the UI. Four knobs appear in both. Three of
 * them had drifted, and the drift was load-bearing: `inference.maxDerivationDepth`
 * capped at 20 while the config file validated against 100, so a file could name a
 * depth the engine's own parameter table called illegal.
 *
 * The two tables are not the same contract — the engine-wide `CoreConfig` and the
 * cognitive-parameter tree are separate surfaces — so the overlap is allowed to
 * exist. What is not allowed is for it to disagree *accidentally*. A knob that
 * appears in both must agree on every field unless that field is declared
 * layer-specific below, which means a future change that introduces a new
 * overlapping knob has to say which layer owns it.
 */
type Row = { min: number; max: number; default: number; step: number };

/** Fields a layer is allowed to set independently, per overlapping knob. */
const LAYER_SPECIFIC: Readonly<Record<string, readonly (keyof Row)[]>> = {
  // Agrees today on every field, and is listed so that a drift is a failure here
  // rather than a surprise — it is the one knob the two tables have always agreed on.
  maxDerivationsPerStep: [],
  // The engine's derivation cap is 20 everywhere else — presets, the RLFP tuner and
  // `inference-controller` all assume it — while the config schema admits 100.
  maxDerivationDepth: ['max'],
  // `DEFAULT_COGNITIVE_PARAMETERS` and `CognitiveController` both fall back to 0;
  // `DEFAULT_CONFIG` throttles at 10, and `createBotNAR` inherits that.
  cpuThrottleMs: ['default'],
  // `TEST_CONFIG` sets `activationDecayRate: 0`, so the cognitive table's floor of
  // 0.001 rejects a value a shipped preset uses.
  activationDecayRate: ['min', 'max'],
};

/** Both tables erased to the shape the comparison needs — the point of the test is
 *  overlap, and overlap is only observable on the widened view. */
const CATEGORIES = cognitiveBounds as unknown as Record<string, Record<string, Row>>;

/** Leaf knob names in `cognitiveBounds`, flattened across its categories. */
const leafNames = (categories: Record<string, Record<string, Row>>): Set<string> =>
  new Set(Object.values(categories).flatMap((rows) => Object.keys(rows)));

const findLeaf = (key: string): Row | undefined =>
  Object.values(CATEGORIES).find((rows) => key in rows)?.[key];

describe('bound tables', () => {
  const shared = Object.keys(narCoreBounds).filter((key) => leafNames(CATEGORIES).has(key));

  it('declares every knob that appears in both tables', () => {
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.filter((key) => !(key in LAYER_SPECIFIC))).toEqual([]);
  });

  it.each(shared)('%s agrees with the other table outside its layer-specific fields', (key) => {
    const core = narCoreBounds[key as keyof typeof narCoreBounds] as Row;
    const cognitive = findLeaf(key) as Row;
    const exempt = new Set(LAYER_SPECIFIC[key] ?? []);
    const drifted = (['min', 'max', 'default', 'step'] as const).filter(
      (field) => !exempt.has(field) && core[field] !== cognitive[field]
    );
    expect(drifted, `${key} drifted on ${drifted.join(', ')}`).toEqual([]);
  });
});
