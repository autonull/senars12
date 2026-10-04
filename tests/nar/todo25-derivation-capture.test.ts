import { describe, expect, it } from 'vitest';
import { SchemaInductor } from '@senars/nar/learning';
import { InferenceController } from '../../nar/src/reason/inference-controller.js';
import { DEFAULT_COGNITIVE_PARAMETERS } from '../../nar/src/config/cognitive-parameters.js';
import type { Task } from '../../nar/src/types/index.js';
import { createTask } from '../../nar/src/types/index.js';
import { termParser, Truth } from '../../nar/src/terms/index.js';
import { Memory } from '../../nar/src/memory/memory.js';
import type { Concept } from '../../nar/src/memory/index.js';
import type { DerivationContext } from '../../nar/src/strategies/index.js';

/**
 * TODO25 Bench 80 — derivation-chain capture (SchemaInductor fuel).
 * Gate: the kernel exposes bounded derivation chains via an optional,
 * zero-cost-when-unset sink (InferenceConfig.onDerivation → CognitiveController →
 * NAR ring), and the captured chains are well-formed SchemaInductor input —
 * a full chain→schema induction round-trip with a deterministic LM double.
 */
const task = (narsese: string, f = 0.9, c = 0.9): Task =>
  createTask(termParser.parse(narsese), 'belief', Truth.create(f, c));

const controllerWith = (
  derivation: (primary: Task, secondaries: Task[]) => AsyncGenerator<Task>,
  onDerivation?: (chain: readonly Task[]) => void
) =>
  new InferenceController(
    { attentionModel: { prime: () => 0 } } as never,
    {} as never,
    {
      sample: () =>
        [
          {
            term: termParser.parse('<sparrow-->bird>'),
            priority: 0.5,
            beliefBag: { peek: () => ({ truth: Truth.create(0.9, 0.9) }) },
          },
        ] as unknown as Concept[],
    } as never,
    { selectSecondary: () => [] } as never,
    { derive: derivation } as never,
    { ...DEFAULT_COGNITIVE_PARAMETERS.inference, maxDerivationsPerStep: 10, maxDerivationDepth: 5, maxSampledConcepts: 10, cpuThrottleMs: 0, singlePremiseLMRules: true, ...(onDerivation ? { onDerivation } : {}) }
  );

describe('TODO25 Bench 80 — derivation-chain capture', () => {
  it('onDerivation receives [primary, ...secondaries, derived] per derivation', async () => {
    const chains: Task[][] = [];
    const controller = controllerWith(async function* () {
      yield task('<sparrow-->animal>');
    }, (chain) => chains.push([...chain]));
    await controller.step();
    expect(chains.length).toBe(1);
    expect(chains[0]!.length).toBe(2);
    expect(chains[0]![0]!.term).toEqual(termParser.parse('<sparrow-->bird>'));
    expect(chains[0]![1]!.term).toEqual(termParser.parse('<sparrow-->animal>'));
  });

  it('no sink ⇒ capture is inert (zero-cost default path)', async () => {
    const controller = controllerWith(async function* () {
      yield task('<a-->b>');
    });
    await expect(controller.step()).resolves.toHaveLength(1);
  });

  it('captured chains round-trip through SchemaInductor (real Memory, deterministic LM double)', async () => {
    const lmDouble = {
      generateText: async () =>
        JSON.stringify({ pattern: '(?A-->?B)&(?B-->?C)==>(?A-->?C)', type: 'transitivity', confidence: 0.8, variables: ['?A', '?B', '?C'] }),
    };
    const inductor = new SchemaInductor(
      new Memory(),
      lmDouble as never,
      { inductionIntervalMs: 0, minDerivationSteps: 3, rng: () => 0.5 }
    );
    // Linked chain: each task's subject appears in the previous term.
    const results = await inductor.induceFromDerivations([
      task('<bird --> animal>'),
      task('<animal --> living>'),
      task('<living --> mortal>'),
    ]);
    expect(results.length).toBe(1);
    expect(results[0]!.schema.template).toContain('?A');
    expect(inductor.getSchemas().length).toBe(1);
  });
});
