/**
 * Phase E (REFACTOR.todo2 §8): strategy composition algebra.
 *
 * Combinators over existing `DerivationStrategy` primitives — `sequence`,
 * `parallel` (first result wins), `conditional`, `loop` (bounded), `timeout`
 * (falls back on abort). Every combinator honors `ctx.signal` (C7/C6):
 * plain-name configs resolve exactly as before; expressions activate only
 * where a caller names one (`CognitiveController.setStrategyExpression`).
 */
import type { Task } from '../types/core.js';

/**
 * Structural derivation surfaces (leaf-typed, import-cycle hygiene): the
 * algebra must not import `strategies/types.js` — that module joins the
 * strategies→lm→nar SCC, and the controller (also in the SCC) composes
 * expressions from here. Everything binds structurally instead.
 */
export type CompositionMetadata = { readonly name: string; readonly description: string };

export type CompositionContext = {
  maxDerivations: number;
  maxDepth: number;
  cpuThrottleMs: number;
  singlePremiseEnabled: boolean;
  signal?: AbortSignal;
};

export type CompositionStrategy = {
  readonly metadata: CompositionMetadata;
  derive(
    primary: Task,
    secondaries: Task[],
    processor: unknown,
    ctx: CompositionContext
  ): AsyncGenerator<Task>;
};

/** Composition-internal derive signature (C6 signal flow). */
export type CompositionRun = (
  primary: Task,
  secondaries: Task[],
  processor: unknown,
  ctx: CompositionContext
) => AsyncGenerator<Task>;

export type StrategyExpression =
  | string
  | {
      readonly op: 'sequence';
      readonly stages: readonly StrategyExpression[];
    }
  | {
      readonly op: 'parallel';
      /** Races the branches; the first branch to produce a task wins exclusively. */
      readonly branches: readonly StrategyExpression[];
    }
  | {
      readonly op: 'conditional';
      when: (primary: Task, ctx: CompositionContext) => boolean;
      then: StrategyExpression;
      otherwise?: StrategyExpression;
    }
  | {
      readonly op: 'loop';
      body: StrategyExpression;
      /** Iteration bound (default 2; hard-capped to keep AIKR bounds). */
      maxIterations?: number;
    }
  | {
      readonly op: 'timeout';
      /** Abort the body after this many ms; run `fallback` (if any) on timeout. */
      ms: number;
      body: StrategyExpression;
      fallback?: StrategyExpression;
    };

/** Resolves named primitives (registry lookup at the composition boundary). */
export type StrategyResolver = (name: string) => CompositionStrategy;

/** Hard iteration ceiling for `loop` regardless of the configured bound. */
const LOOP_HARD_CAP = 64;

const compositeMeta = (expr: StrategyExpression): CompositionMetadata => ({
  name: describeStrategyExpression(expr),
  description: 'Composed derivation strategy (strategy algebra, REFACTOR.todo2 Phase E)',
});

class CompositeDerivation implements CompositionStrategy {
  readonly metadata: CompositionMetadata;
  constructor(
    expr: StrategyExpression,
    private readonly run: CompositionRun
  ) {
    this.metadata = compositeMeta(expr);
  }
  derive(
    primary: Task,
    secondaries: Task[],
    processor: unknown,
    ctx: CompositionContext
  ): AsyncGenerator<Task> {
    return this.run(primary, secondaries, processor, ctx);
  }
}

const sequenceRun =
  (stages: readonly CompositionStrategy[]): CompositionRun =>
  async function* (primary, secondaries, processor, ctx) {
    for (const stage of stages) {
      if (ctx.signal?.aborted) return;
      yield* stage.derive(primary, secondaries, processor, ctx);
    }
  };

const parallelRun =
  (branches: readonly CompositionStrategy[]): CompositionRun =>
  async function* (primary, secondaries, processor, ctx) {
    const pending = new Map<AsyncGenerator<Task>, Promise<IteratorResult<Task>>>();
    for (const branch of branches) {
      const gen = branch.derive(primary, secondaries, processor, ctx);
      pending.set(gen, gen.next());
    }
    try {
      while (pending.size > 0) {
        if (ctx.signal?.aborted) return;
        const raced = await Promise.race(
          [...pending.values()].map((p) => p.then((r) => ({ p, r })))
        );
        const winner = [...pending.entries()].find(([g, p]) => p === raced.p)?.[0];
        if (!winner) return;
        pending.delete(winner);
        if (raced.r.done) continue;
        // First result wins: cancel the losers, drain the winner exclusively.
        for (const [g, p] of pending) {
          p.catch(() => {});
          void g.return(undefined as never).catch(() => {});
        }
        pending.clear();
        yield raced.r.value;
        yield* winner;
        return;
      }
    } finally {
      for (const [g, p] of pending) {
        p.catch(() => {});
        void g.return(undefined as never).catch(() => {});
      }
    }
  };

const conditionalRun =
  (
    when: (primary: Task, ctx: CompositionContext) => boolean,
    thenBranch: CompositionStrategy,
    otherwise?: CompositionStrategy
  ): CompositionRun =>
  async function* (primary, secondaries, processor, ctx) {
    const branch = when(primary, ctx) ? thenBranch : otherwise;
    if (branch) yield* branch.derive(primary, secondaries, processor, ctx);
  };

const loopRun =
  (body: CompositionStrategy, maxIterations: number): CompositionRun =>
  async function* (primary, secondaries, processor, ctx) {
    const bound = Math.min(Math.max(1, Math.floor(maxIterations)), LOOP_HARD_CAP);
    for (let i = 0; i < bound; i++) {
      if (ctx.signal?.aborted) return;
      let produced = 0;
      for await (const task of body.derive(primary, secondaries, processor, ctx)) {
        if (ctx.signal?.aborted) return;
        produced++;
        yield task;
      }
      if (produced === 0) return;
    }
  };

const timeoutRun =
  (ms: number, body: CompositionStrategy, fallback?: CompositionStrategy): CompositionRun =>
  async function* (primary, secondaries, processor, ctx) {
    if (ctx.signal?.aborted) return;
    let timedOut = false;
    const deadline = new Promise<'timeout'>((resolve) => {
      const t = setTimeout(() => resolve('timeout'), ms);
      t.unref?.();
    });
    const gen = body.derive(primary, secondaries, processor, ctx);
    try {
      while (true) {
        const raced = await Promise.race([
          gen.next().then((r) => ({ r })),
          deadline.then((v) => ({ timeout: v })),
        ]);
        if ('timeout' in raced) {
          timedOut = true;
          break;
        }
        if (raced.r.done) return;
        yield raced.r.value;
      }
    } finally {
      await gen.return(undefined as never).catch(() => {});
    }
    if (timedOut && !ctx.signal?.aborted && fallback) {
      yield* fallback.derive(primary, secondaries, processor, ctx);
    }
  };

/** Deterministic label for a composed strategy (used as metadata name + registry key). */
export function describeStrategyExpression(expr: StrategyExpression): string {
  if (typeof expr === 'string') return expr;
  switch (expr.op) {
    case 'sequence':
      return `seq(${expr.stages.map(describeStrategyExpression).join(',')})`;
    case 'parallel':
      return `par(${expr.branches.map(describeStrategyExpression).join(',')})`;
    case 'conditional':
      return `cond(${describeStrategyExpression(expr.then)}|${expr.otherwise ? describeStrategyExpression(expr.otherwise) : '∅'})`;
    case 'loop':
      return `loop(${describeStrategyExpression(expr.body)},×${expr.maxIterations ?? 2})`;
    case 'timeout':
      return `timeout(${expr.ms},${describeStrategyExpression(expr.body)})`;
  }
}

function buildRun(expr: Exclude<StrategyExpression, string>, resolve: StrategyResolver): CompositionRun {
  const child = (e: StrategyExpression): CompositionStrategy =>
    typeof e === 'string' ? resolve(e) : composeStrategy(e, resolve);
  switch (expr.op) {
    case 'sequence':
      return sequenceRun(expr.stages.map(child));
    case 'parallel':
      return parallelRun(expr.branches.map(child));
    case 'conditional':
      return conditionalRun(expr.when, child(expr.then), expr.otherwise ? child(expr.otherwise) : undefined);
    case 'loop':
      return loopRun(child(expr.body), expr.maxIterations ?? 2);
    case 'timeout':
      return timeoutRun(expr.ms, child(expr.body), expr.fallback ? child(expr.fallback) : undefined);
  }
}

export function composeStrategy(expr: StrategyExpression, resolve: StrategyResolver): CompositionStrategy {
  if (typeof expr === 'string') return resolve(expr);
  return new CompositeDerivation(expr, buildRun(expr, resolve));
}
