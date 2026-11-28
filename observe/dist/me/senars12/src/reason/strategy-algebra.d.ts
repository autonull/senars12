import type { Task } from '../types/core';
/**
 * Structural derivation surfaces (leaf-typed, import-cycle hygiene): the
 * algebra must not import `strategies/types.js` — that module joins the
 * strategies→lm→nar SCC, and the controller (also in the SCC) composes
 * expressions from here. Everything binds structurally instead.
 */
export type CompositionMetadata = {
    readonly name: string;
    readonly description: string;
};
export type CompositionContext = {
    maxDerivations: number;
    maxDepth: number;
    cpuThrottleMs: number;
    singlePremiseEnabled: boolean;
    signal?: AbortSignal;
};
export type CompositionStrategy = {
    readonly metadata: CompositionMetadata;
    derive(primary: Task, secondaries: Task[], processor: unknown, ctx: CompositionContext): AsyncGenerator<Task>;
};
/** Composition-internal derive signature (C6 signal flow). */
export type CompositionRun = (primary: Task, secondaries: Task[], processor: unknown, ctx: CompositionContext) => AsyncGenerator<Task>;
export type StrategyExpression = string | {
    readonly op: 'sequence';
    readonly stages: readonly StrategyExpression[];
} | {
    readonly op: 'parallel';
    /** Races the branches; the first branch to produce a task wins exclusively. */
    readonly branches: readonly StrategyExpression[];
} | {
    readonly op: 'conditional';
    when: (primary: Task, ctx: CompositionContext) => boolean;
    then: StrategyExpression;
    otherwise?: StrategyExpression;
} | {
    readonly op: 'loop';
    body: StrategyExpression;
    /** Iteration bound (default 2; hard-capped to keep AIKR bounds). */
    maxIterations?: number;
} | {
    readonly op: 'timeout';
    /** Abort the body after this many ms; run `fallback` (if any) on timeout. */
    ms: number;
    body: StrategyExpression;
    fallback?: StrategyExpression;
};
/** Resolves named primitives (registry lookup at the composition boundary). */
export type StrategyResolver = (name: string) => CompositionStrategy;
/** Deterministic label for a composed strategy (used as metadata name + registry key). */
export declare function describeStrategyExpression(expr: StrategyExpression): string;
export declare function composeStrategy(expr: StrategyExpression, resolve: StrategyResolver): CompositionStrategy;
//# sourceMappingURL=strategy-algebra.d.ts.map