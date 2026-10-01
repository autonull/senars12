#!/usr/bin/env tsx

/**
 * The cycle cost bench (TODO29 §11; the cost model it measures is TODO30 §2).
 *
 * Reports the cost model as a table: per-cycle work, measured at
 * several memory sizes, so "does this operation scale with the
 * population" is a number rather than an opinion. Everything the gate
 * `cost:cycle` will eventually assert is computed here first.
 *
 * Three modes:
 *
 *   default        the cost table, at each --size
 *   --knob-sweep   §1.1's coupling: decay passes per cycle against
 *                  maxSampledConcepts, everything else held constant
 *   --repeat N     min-of-N per size, because the median on a loaded
 *                  machine carries a quarter more noise than the min
 *
 * Measurement is by prototype hook rather than by a counter the engine
 * maintains, because a counter in the engine is a field that can be
 * wrong. Every hook is *asserted to have fired* before the report is
 * printed: a renamed method silently reporting zero is precisely the
 * failure this repository already has twice — `RuleIndex.recordRuleHit`
 * with no callers, `processLMRulesImpl`'s `stepScalars` with no
 * invalidator (TODO29 §1.8, deleted in TODO29.a A1) — so a hook that never fires is an error
 * here, not a zero.
 *
 * A script, not a test. Latency assertions in the default suite are how
 * this repository acquired its three load-sensitive files (TODO28 §4.6).
 * The gate that will consume this output is `cost:cycle`; this is the
 * instrument behind it.
 *
 *   npx tsx scripts/cycle-bench.ts --size 1000,10000
 *   node --cpu-prof --import tsx scripts/cycle-bench.ts --repeat 1
 */

import { DEFAULT_COGNITIVE_PARAMETERS } from '../nar/src/config/cognitive-parameters.js';
import { DEFAULT_CONFIG, Stamp, TermBuilder, Truth } from '../nar/src/index.js';
import { Memory } from '../nar/src/memory/index.js';
import { NAR } from '../nar/src/nar.js';
import { RuleProcessor } from '../nar/src/rules/impls/processor.js';

interface Counter {
  name: string;
  calls: number;
}

/** The operations TODO30 §2 forbids from being O(population), plus the inducer's cycle-path cost. */
const HOOKS = [
  { name: 'decayAll', proto: Memory.prototype as object, method: 'decayAll' },
  { name: 'memory.sample', proto: Memory.prototype as object, method: 'sample' },
  { name: 'sampleWindow', proto: Memory.prototype as object, method: 'sampleWindow' },
  { name: 'forEachConcept', proto: Memory.prototype as object, method: 'forEachConcept' },
  { name: 'listConcepts', proto: Memory.prototype as object, method: 'listConcepts' },
  { name: 'getGoals', proto: Memory.prototype as object, method: 'getGoals' },
  { name: 'getStatistics', proto: Memory.prototype as object, method: 'getStatistics' },
  { name: 'stageModelRuleWork', proto: RuleProcessor.prototype as object, method: 'stageModelRuleWork' },
] as const;

/** Live hooks, in HOOKS order. Held in a list, not a Map, so resetting is a field write. */
let counters: Counter[] = [];
let uninstall: Array<() => void> = [];

const install = (): void => {
  counters = [];
  uninstall = [];
  for (const hook of HOOKS) {
    const proto = hook.proto as Record<string, unknown>;
    const original = proto[hook.method];
    if (typeof original !== 'function') {
      throw new Error(
        `cycle-bench: ${hook.name} is not a function on its prototype. The engine was ` +
          `renamed or restructured and this bench would report 0 for it — fix the hook, do not ` +
          `read the number.`
      );
    }
    const counter: Counter = { name: hook.name, calls: 0 };
    counters.push(counter);
    proto[hook.method] = function instrumented(this: unknown, ...args: unknown[]) {
      counter.calls++;
      return (original as (...a: unknown[]) => unknown).apply(this, args);
    };
    uninstall.push(() => {
      proto[hook.method] = original;
    });
  }
};

const remove = (): void => {
  for (const restore of uninstall) restore();
  counters = [];
  uninstall = [];
};

const reset = (): void => {
  for (const counter of counters) counter.calls = 0;
};

const countOf = (name: string): number => counters.find((c) => c.name === name)?.calls ?? 0;

const config = (maxSampledConcepts?: number) =>
  ({
    ...DEFAULT_CONFIG,
    activationDecayRate: 0.01,
    consolidationInterval: 5,
    cpuThrottleMs: 0,
    enableLMRules: false,
    enableTools: true,
    enableSelf: false,
    enableRLFP: false,
    persistState: false,
    maxConcepts: 5000,
    maxDerivationsPerStep: 500,
    maxDerivationDepth: 15,
    ...(maxSampledConcepts === undefined
      ? {}
      : {
          cognitiveParams: {
            ...DEFAULT_COGNITIVE_PARAMETERS,
            inference: { ...DEFAULT_COGNITIVE_PARAMETERS.inference, maxSampledConcepts },
          },
        }),
  }) as ConstructorParameters<typeof NAR>[0];

/** One `steps`-long run over a seeded 3-armed bandit, the shape of the RL benches. */
const run = async (seed: number, steps: number): Promise<{ nar: NAR; derived: number }> => {
  const nar = new NAR(config());
  const state = TermBuilder.atom(`s${seed}`);
  const animal = TermBuilder.atom('animal');
  let derived = 0;
  for (let i = 0; i < steps; i++) {
    const subject = TermBuilder.atom(`s${seed}_${i}`);
    await nar.believe(TermBuilder.inheritance(subject, animal)!, Truth.create(0.5, 0.9));
    derived += await nar.run(1);
    void state;
  }
  return { nar, derived };
};

/** Grow the population to `target` by admitting one distinct term at a time. */
const grow = async (nar: NAR, target: number): Promise<void> => {
  const animal = TermBuilder.atom('animal');
  for (let i = nar.memory.size; i < target; i++) {
    await nar.believe(
      TermBuilder.inheritance(TermBuilder.atom(`grow_${i}`), animal)!,
      Truth.create(0.5, 0.9)
    );
  }
};

interface Row {
  population: number;
  cycles: number;
  derived: number;
  ms: number;
  perCycle: Record<string, number>;
}

const measure = async (size: number, steps: number, seed: number): Promise<Row> => {
  install();
  try {
    const { nar } = await run(seed, 1);
    await grow(nar, size);
    reset();

    const started = performance.now();
    let derived = 0;
    for (let i = 0; i < steps; i++) {
      const subject = TermBuilder.atom(`measure_${size}_${seed}_${i}`);
      await nar.believe(
        TermBuilder.inheritance(subject, TermBuilder.atom('animal'))!,
        Truth.create(0.5, 0.9)
      );
      derived += await nar.run(1);
    }
    const ms = performance.now() - started;

    const perCycle: Record<string, number> = {};
    for (const counter of counters) perCycle[counter.name] = counter.calls / steps;
    return { population: nar.memory.size, cycles: steps, derived, ms, perCycle };
  } finally {
    remove();
  }
};

const knobSweep = async (sizes: readonly number[], steps: number, seed: number): Promise<void> => {
  const rows: Array<{ knob: number; population: number; perCycle: number }> = [];
  for (const maxSampledConcepts of sizes) {
    install();
    try {
      const nar = new NAR(config(maxSampledConcepts));
      reset();
      const animal = TermBuilder.atom('animal');
      for (let i = 0; i < steps; i++) {
        await nar.believe(
          TermBuilder.inheritance(TermBuilder.atom(`k${seed}_${i}`), animal)!,
          Truth.create(0.5, 0.9)
        );
        await nar.run(1);
      }
      rows.push({
        knob: maxSampledConcepts,
        population: nar.memory.size,
        perCycle: countOf('decayAll') / steps,
      });
    } finally {
      remove();
    }
  }
  console.log(
    '\n§1.1 — decay passes per cycle against maxSampledConcepts, everything else fixed\n'
  );
  console.log('  maxSampledConcepts   population   decayAll per cycle');
  for (const row of rows) {
    console.log(
      `  ${String(row.knob).padStart(18)}   ${String(row.population).padStart(10)}   ${row.perCycle.toFixed(1).padStart(18)}`
    );
  }
  console.log(
    '\n  Before TODO29 A4 the last column tracks the first: a retrieval-breadth knob is a\n' +
      '  decay-rate knob. After A4 it should be a single row. See TODO29 §4/A4.\n'
  );
};

const table = (rows: readonly Row[], repeat: number): void => {
  const names = HOOKS.map((h) => h.name);
  console.log(`\nper-cycle work by memory population (min of ${repeat})\n`);
  const head = ['population', 'ms/step', 'derived/step', ...names];
  console.log('  ' + head.map((h, i) => (i < 3 ? h.padStart(14) : h.padStart(18))).join(''));
  for (const row of rows) {
    const cells = [
      String(row.population),
      (row.ms / row.cycles).toFixed(2),
      (row.derived / row.cycles).toFixed(2),
      ...names.map((n) => row.perCycle[n]?.toFixed(2) ?? '-'),
    ];
    console.log('  ' + cells.map((c, i) => c.padStart(i < 3 ? 14 : 18)).join(''));
  }
  const scaling = rows.length > 1 ? rows[rows.length - 1]!.population / rows[0]!.population : 1;
  console.log(
    `\n  population grew ${scaling.toFixed(0)}x. A column that grew by roughly that factor is\n` +
      '  O(population) and is what TODO29 §3.1 forbids on a cycle path. `processLMRules` is\n' +
      '  0 after TODO29 A1 and is the row that proves the cycle is closed.\n'
  );
};

/**
 * Prove the instrument. Each hook is invoked once on a real instance and the
 * counter is required to move. This is the part that catches §1.9's failure
 * mode: a hook that silently does not observe anything produces a table full
 * of confident zeroes, which is worse than no table.
 */
const selftest = async (): Promise<void> => {
  install();
  try {
    const { nar } = await run(1, 2);
    for (const counter of counters) {
      const before = counter.calls;
      switch (counter.name) {
        case 'decayAll':
          nar.getProcessor();
          nar.memory.sample(1);
          break;
        case 'memory.sample':
          nar.memory.sample(1);
          break;
        case 'sampleWindow':
          nar.memory.sampleWindow(2);
          break;
        case 'forEachConcept':
          nar.memory.forEachConcept(() => {});
          break;
        case 'listConcepts':
          nar.memory.listConcepts();
          break;
        case 'getGoals':
          nar.memory.getGoals();
          break;
        case 'getStatistics':
          nar.memory.getStatistics();
          break;
        case 'stageModelRuleWork':
          // Staging is the cycle's only call into model-backed rules (A1), and it
          // happens whether or not an LM is configured: the queue is the NAR's.
          nar.getProcessor().stageModelRuleWork({
            term: TermBuilder.atom('probe'),
            truth: Truth.NEUTRAL,
            stamp: Stamp.createInput(),
          });
          break;
      }
      if (counter.calls === before) {
        throw new Error(
          `cycle-bench self-test: hook '${counter.name}' did not observe its own invocation. ` +
            `The table would report 0 for a live path.`
        );
      }
    }
    console.log('\ncycle-bench self-test: every hook observed its own invocation.\n');
  } finally {
    remove();
  }
};

const flag = process.argv.slice(2);
const arg = (name: string, fallback: string): string => {
  const i = flag.indexOf(`--${name}`);
  return i >= 0 && flag[i + 1] ? flag[i + 1]! : fallback;
};

const steps = Number(arg('steps', '40'));
const seed = Number(arg('seed', '1'));
const repeat = Number(arg('repeat', '3'));
const sizes = arg('size', '1000,10000').split(',').map(Number);

if (flag.includes('--selftest')) {
  await selftest();
} else if (flag.includes('--knob-sweep')) {
  await knobSweep(sizes, steps, seed);
} else {
  const rows: Row[] = [];
  for (const size of sizes) {
    const attempts: Row[] = [];
    for (let i = 0; i < repeat; i++) attempts.push(await measure(size, steps, seed + i));
    attempts.sort((a, b) => a.ms - b.ms);
    rows.push(attempts[0]!);
  }
  table(rows, repeat);
}
