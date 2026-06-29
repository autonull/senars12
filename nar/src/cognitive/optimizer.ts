import fs from 'node:fs';
import type { CognitiveParameters } from '../config/cognitive-parameters';
import { DEFAULT_COGNITIVE_PARAMETERS, mergeParameters } from '../config/cognitive-parameters';
import type { NAR } from '../nar';
import type { MetricsSummary, SearchSpace } from '../strategies';
import type { Task } from '../types';
import type { CognitiveRegistry } from './registry';

// ── Parameter Mapping ────────────────────────────────────────────

const PARAMETER_MAP: Record<string, (p: CognitiveParameters, v: unknown) => void> = {
  'priority.initial': (p, v) => {
    p.priority.initialPriority = v as number;
  },
  'priority.directMentionBoost': (p, v) => {
    p.priority.directMentionBoost = v as number;
  },
  'priority.decayRate': (p, v) => {
    p.priority.decayRate = v as number;
  },
  'strategy.sampling': (p, v) => {
    p.strategies.sampling.type = v as string;
  },
  'strategy.premise': (p, v) => {
    p.strategies.premise.type = v as string;
  },
  'strategy.lmRule': (p, v) => {
    p.strategies.lmRule.type = v as string;
  },
  'strategy.derivation': (p, v) => {
    p.strategies.derivation.type = v as string;
  },
  'strategy.attention': (p, v) => {
    p.strategies.attention.type = v as string;
  },
  'lm.maxRules': (p, v) => {
    p.strategies.lmRule.maxRules = v as number;
  },
  'lm.timeout': (p, v) => {
    p.lm.callTimeoutMs = v as number;
  },
  'inference.maxDerivations': (p, v) => {
    p.inference.maxDerivationsPerStep = v as number;
  },
  'inference.maxDepth': (p, v) => {
    p.inference.maxDerivationDepth = v as number;
  },
};

export function applyParamValues(
  params: CognitiveParameters,
  values: Record<string, unknown>
): CognitiveParameters {
  const clone = structuredClone(params);
  for (const [key, value] of Object.entries(values)) PARAMETER_MAP[key]?.(clone, value);
  return clone;
}

// ── Search Space ──────────────────────────────────────────────────

export const COGNITIVE_PARAMETER_SPACE: SearchSpace = {
  parameters: {
    'priority.initial': { type: 'float', min: 0.01, max: 0.3, log: true },
    'priority.directMentionBoost': { type: 'float', min: 0.1, max: 0.5 },
    'priority.decayRate': { type: 'float', min: 0.01, max: 0.2 },
    'strategy.sampling': {
      type: 'categorical',
      values: ['priority', 'top-n', 'novelty', 'goal-biased', 'diverse'],
    },
    'strategy.premise': {
      type: 'categorical',
      values: [
        'default-formation',
        'bag',
        'prolog',
        'resolution',
        'goal-driven',
        'analogical',
        'term-link',
        'task-match',
        'decomposition',
        'exhaustive',
      ],
    },
    'strategy.lmRule': { type: 'categorical', values: ['all', 'priority', 'rotation', 'diverse'] },
    'strategy.attention': {
      type: 'categorical',
      values: ['simple', 'spreading', 'goal-relevance', 'composite'],
    },
    'strategy.derivation': {
      type: 'categorical',
      values: ['default', 'anytime', 'focused', 'sampled'],
    },
    'lm.maxRules': { type: 'int', min: 1, max: 13 },
    'lm.timeout': { type: 'int', min: 1000, max: 30000, log: true },
    'inference.maxDerivations': { type: 'int', min: 100, max: 10000, log: true },
    'inference.maxDepth': { type: 'int', min: 5, max: 20 },
  },
};

// ── Samplers ──────────────────────────────────────────────────────

export abstract class ParamSampler {
  abstract readonly space: SearchSpace;

  abstract sample(): Record<string, unknown>;

  abstract reset(): void;
}

export class GridSampler extends ParamSampler {
  private enumerator: Generator<Record<string, unknown>>;

  constructor(public readonly space: SearchSpace) {
    super();
    this.enumerator = this.enumerate(space);
  }

  sample(): Record<string, unknown> {
    const next = this.enumerator.next();
    if (next.done) {
      this.reset();
      return this.sample();
    }
    return next.value;
  }

  reset(): void {
    this.enumerator = this.enumerate(this.space);
  }

  private *enumerate(space: SearchSpace): Generator<Record<string, unknown>> {
    const entries = Object.entries(space.parameters);
    if (entries.length === 0) return;

    const keys: string[] = [];
    const grids: unknown[][] = [];

    for (const [key, param] of entries) {
      if (!param) continue;
      keys.push(key);
      switch (param.type) {
        case 'categorical':
          grids.push(param.values ?? []);
          break;
        case 'boolean':
          grids.push([true, false]);
          break;
        case 'float': {
          const rawMin = param.min ?? 0;
          const rawMax = param.max ?? 1;
          const lo = param.log ? Math.log(rawMin) : rawMin;
          const hi = param.log ? Math.log(rawMax) : rawMax;
          const mid = (lo + hi) / 2;
          const grid = param.log ? [Math.exp(lo), Math.exp(mid), Math.exp(hi)] : [lo, mid, hi];
          grids.push(grid);
          break;
        }
        case 'int': {
          const min = Math.floor(param.min ?? 0);
          const max = Math.floor(param.max ?? 10);
          const vals: number[] = [];
          for (let i = min; i <= max; i++) vals.push(i);
          if (vals.length > 5) {
            grids.push([vals[0], vals[Math.floor(vals.length / 2)], vals[vals.length - 1]]);
          } else {
            grids.push(vals);
          }
          break;
        }
      }
    }

    if (keys.length === 0 || grids.length === 0) return;

    const n = keys.length;
    const indices = new Array<number>(n).fill(0);

    while (true) {
      const entry: Record<string, unknown> = {};
      for (let i = 0; i < n; i++) {
        const k = keys[i]!;
        entry[k] = grids[i]![indices[i]!];
      }
      yield entry;

      let carry = 1;
      for (let i = n - 1; i >= 0 && carry > 0; i--) {
        indices[i]!++;
        if (indices[i]! >= grids[i]!.length) {
          indices[i] = 0;
        } else {
          carry = 0;
        }
      }
      if (carry > 0) break;
    }
  }
}

export class RandomSampler extends ParamSampler {
  constructor(public readonly space: SearchSpace) {
    super();
  }

  reset(): void {}

  sample(): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const [key, param] of Object.entries(this.space.parameters)) {
      if (!param) continue;
      switch (param.type) {
        case 'float': {
          const rawMin = param.min ?? 0;
          const rawMax = param.max ?? 1;
          const lo = param.log ? Math.log(rawMin) : rawMin;
          const hi = param.log ? Math.log(rawMax) : rawMax;
          const v = Math.random() * (hi - lo) + lo;
          values[key] = param.log ? Math.exp(v) : v;
          break;
        }
        case 'int': {
          const min = Math.floor(param.min ?? 0);
          const max = Math.floor(param.max ?? 10);
          values[key] = Math.floor(Math.random() * (max - min + 1)) + min;
          break;
        }
        case 'categorical':
          values[key] = (param.values ?? [])[
            Math.floor(Math.random() * (param.values?.length ?? 1))
          ];
          break;
        case 'boolean':
          values[key] = Math.random() > 0.5;
          break;
      }
    }
    return values;
  }
}

// ── Optimizer ─────────────────────────────────────────────────────

export interface OptimizationResult {
  params: CognitiveParameters;
  score: number;
  algorithm: string;
  timestamp: number;
  evaluations: number;
  duration: number;
}

export class CognitiveOptimizer {
  private bestScore = Number.NEGATIVE_INFINITY;
  private bestParams: CognitiveParameters | null = null;
  private results: OptimizationResult[] = [];

  constructor(
    private readonly objective: { name: string; evaluate: (m: MetricsSummary) => number },
    private readonly searchSpace: SearchSpace,
    private readonly nar: NAR,
    private readonly benchmarkTasks: Task[],
    private readonly registry: CognitiveRegistry
  ) {}

  static loadResults(path: string): { best: OptimizationResult; history: OptimizationResult[] } {
    return JSON.parse(fs.readFileSync(path, 'utf-8'));
  }

  async optimize(
    algorithm: 'grid' | 'random',
    budget: {
      maxEvaluations: number;
      maxTime: number;
    }
  ): Promise<OptimizationResult> {
    const sampler =
      algorithm === 'grid'
        ? new GridSampler(this.searchSpace)
        : new RandomSampler(this.searchSpace);
    const startTime = Date.now();

    for (let i = 0; i < budget.maxEvaluations; i++) {
      if (Date.now() - startTime > budget.maxTime) break;
      const values = sampler.sample();
      const trialParams = applyParamValues(structuredClone(DEFAULT_COGNITIVE_PARAMETERS), values);
      this.applyConfig(trialParams);
      this.runBenchmark();
      const score = this.objective.evaluate(this.nar.getMetrics() as MetricsSummary);

      if (score > this.bestScore) {
        this.bestScore = score;
        this.bestParams = trialParams;
      }
    }

    return this.saveResult(algorithm, budget.maxEvaluations, Date.now() - startTime);
  }

  saveResults(path: string): void {
    const data = JSON.stringify(
      {
        best: this.results[this.results.length - 1],
        history: this.results,
        space: this.searchSpace,
        objective: this.objective.name,
      },
      null,
      2
    );
    fs.writeFileSync(path, data, 'utf-8');
  }

  getBestParams(): CognitiveParameters | null {
    return this.bestParams ? structuredClone(this.bestParams) : null;
  }

  private applyConfig(params: CognitiveParameters): void {
    this.nar.reconfigure(params);
  }

  private runBenchmark(): void {
    for (const task of this.benchmarkTasks) this.nar.inputTask(task);
    this.nar.run(10);
  }

  private saveResult(algorithm: string, evaluations: number, duration: number): OptimizationResult {
    const result: OptimizationResult = {
      params: this.bestParams!,
      score: this.bestScore,
      algorithm,
      timestamp: Date.now(),
      evaluations,
      duration,
    };
    this.results.push(result);
    return result;
  }
}

// ── Serialization ─────────────────────────────────────────────────

export function serializeParams(params: CognitiveParameters): string {
  return JSON.stringify(params, null, 2);
}

export function deserializeParams(json: string): CognitiveParameters {
  return mergeParameters(JSON.parse(json));
}
