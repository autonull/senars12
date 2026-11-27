/**
 * Phase E (REFACTOR.todo2 §8): strategy composition algebra.
 *
 * Combinators over existing `DerivationStrategy` primitives — `sequence`,
 * `parallel` (first result wins), `conditional`, `loop` (bounded), `timeout`
 * (falls back on abort). Every combinator honors `ctx.signal` (C7/C6):
 * plain-name configs resolve exactly as before; expressions activate only
 * where a caller names one (`CognitiveParameters.strategies.derivation.type`).
 */
import { clamp } from '@senars/util/numeric';
import { raceDeadline } from '@senars/util/async';
/** Hard iteration ceiling for `loop` regardless of the configured bound. */
const LOOP_HARD_CAP = 64;
const compositeMeta = (expr) => ({
    name: describeStrategyExpression(expr),
    description: 'Composed derivation strategy (strategy algebra, REFACTOR.todo2 Phase E)',
});
class CompositeDerivation {
    run;
    metadata;
    constructor(expr, run) {
        this.run = run;
        this.metadata = compositeMeta(expr);
    }
    derive(primary, secondaries, processor, ctx) {
        return this.run(primary, secondaries, processor, ctx);
    }
}
const sequenceRun = (stages) => async function* (primary, secondaries, processor, ctx) {
    for (const stage of stages) {
        if (ctx.signal?.aborted)
            return;
        yield* stage.derive(primary, secondaries, processor, ctx);
    }
};
const parallelRun = (branches) => async function* (primary, secondaries, processor, ctx) {
    const pending = new Map();
    for (const branch of branches) {
        const gen = branch.derive(primary, secondaries, processor, ctx);
        pending.set(gen, gen.next());
    }
    try {
        while (pending.size > 0) {
            if (ctx.signal?.aborted)
                return;
            const raced = await Promise.race([...pending.values()].map((p) => p.then((r) => ({ p, r }))));
            const winner = [...pending.entries()].find(([g, p]) => p === raced.p)?.[0];
            if (!winner)
                return;
            pending.delete(winner);
            if (raced.r.done)
                continue;
            // First result wins: cancel the losers, drain the winner exclusively.
            for (const [g, p] of pending) {
                p.catch(() => { });
                void g.return(undefined).catch(() => { });
            }
            pending.clear();
            yield raced.r.value;
            yield* winner;
            return;
        }
    }
    finally {
        for (const [g, p] of pending) {
            p.catch(() => { });
            void g.return(undefined).catch(() => { });
        }
    }
};
const conditionalRun = (when, thenBranch, otherwise) => async function* (primary, secondaries, processor, ctx) {
    const branch = when(primary, ctx) ? thenBranch : otherwise;
    if (branch)
        yield* branch.derive(primary, secondaries, processor, ctx);
};
const loopRun = (body, maxIterations) => async function* (primary, secondaries, processor, ctx) {
    const bound = clamp(Math.floor(maxIterations), 1, LOOP_HARD_CAP);
    for (let i = 0; i < bound; i++) {
        if (ctx.signal?.aborted)
            return;
        let produced = 0;
        for await (const task of body.derive(primary, secondaries, processor, ctx)) {
            if (ctx.signal?.aborted)
                return;
            produced++;
            yield task;
        }
        if (produced === 0)
            return;
    }
};
const timeoutRun = (ms, body, fallback) => async function* (primary, secondaries, processor, ctx) {
    if (ctx.signal?.aborted)
        return;
    const gen = body.derive(primary, secondaries, processor, ctx);
    let timedOut = false;
    try {
        while (true) {
            const raced = await raceDeadline(gen.next(), ms);
            if (raced.timedOut) {
                timedOut = true;
                break;
            }
            if (raced.value.done)
                return;
            yield raced.value.value;
        }
    }
    finally {
        await gen.return(undefined).catch(() => { });
    }
    if (timedOut && !ctx.signal?.aborted && fallback) {
        yield* fallback.derive(primary, secondaries, processor, ctx);
    }
};
/** Deterministic label for a composed strategy (used as metadata name + registry key). */
export function describeStrategyExpression(expr) {
    if (typeof expr === 'string')
        return expr;
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
function buildRun(expr, resolve) {
    const child = (e) => typeof e === 'string' ? resolve(e) : composeStrategy(e, resolve);
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
export function composeStrategy(expr, resolve) {
    if (typeof expr === 'string')
        return resolve(expr);
    return new CompositeDerivation(expr, buildRun(expr, resolve));
}
