/**
 * The focus task vocabulary, and the one projection into it.
 *
 * Game perceptions, reflex proposals and outcomes all arrive as *records* and
 * leave as `FocusTask[]` in the focus's bag. That is a projection, not a gate:
 * nothing here refuses anything, so naming it after the kernel gates
 * (`KernelPerceptionGate` and friends, which do refuse) claimed an authority
 * these functions never had. One module holds the factory, the term builders
 * and all three projections so the vocabulary has a single home.
 */
import { clamp01 } from '@senars/util/numeric';
import { systemClock } from '@senars/util/clock';
import { expectedValue } from '../reflex/Reflex';
import { operationTerm, TermBuilder, toAtomSymbol } from '../terms';
import { createTaskWeight } from '../types/core';
export const focusTask = ({ id, term, type, priority, budgetPriority = priority, f, c, stamp, }) => ({
    id,
    term,
    type,
    priority,
    truth: { f, c },
    budget: createTaskWeight(budgetPriority),
    stamp,
    derived: false,
});
/** `snake` — the game state as a plain belief. */
export const stateTerm = (stateId) => TermBuilder.atom(toAtomSymbol(stateId));
/** `[score_3]` — a named feature observed at a value. */
export const featureTerm = (feature, value) => TermBuilder.setInt(TermBuilder.atom(toAtomSymbol(`${feature}_${String(value)}`)));
/** `[reward_positive]` — the sign of an outcome. */
export const rewardTerm = (reward) => TermBuilder.setInt(TermBuilder.atom(reward >= 0 ? 'reward_positive' : 'reward_negative'));
/** `move(left --> right)` — a reflex proposal as an executable operation term. */
export const actionTerm = (action, args) => operationTerm(action, args);
const DEFAULT_PERCEPTION_CONFIDENCE = 0.9;
/**
 * The provenance of one projected batch.
 *
 * The clock is read **once** per batch and every id and stamp is derived from
 * that reading, so all the tasks admitted together share one stamp — under a
 * pinned clock a batch reproduces down to its ids, which is what makes a focus
 * step comparable across runs instead of only across terms.
 */
const batch = (clock, source) => {
    const now = clock();
    return {
        stamp: (...parts) => [source, ...parts, String(now)].join('-'),
        id: (prefix, key) => (key ? `${prefix}-${key}` : prefix) + `-${now}`,
    };
};
/** A game observation as the state belief plus one belief per numeric feature. */
export const perceptionTasks = (perception, clock = systemClock) => {
    const { id, stamp } = batch(clock, 'perception');
    const confidence = perception.confidence ?? DEFAULT_PERCEPTION_CONFIDENCE;
    const tasks = [
        focusTask({
            id: id('percept-state', perception.stateId),
            term: stateTerm(perception.stateId),
            type: 'belief',
            priority: confidence,
            f: 1.0,
            c: confidence,
            stamp: stamp(),
        }),
    ];
    for (const [feature, value] of Object.entries(perception.features ?? {})) {
        const magnitude = Math.abs(Number(value));
        tasks.push(focusTask({
            id: id('percept-feature', feature),
            term: featureTerm(feature, Number(value)),
            type: 'belief',
            priority: magnitude * confidence,
            budgetPriority: magnitude,
            f: clamp01(magnitude),
            c: confidence,
            stamp: stamp(),
        }));
    }
    return tasks;
};
/** An outcome as a reward-sign belief, plus a terminal flag when the episode ended. */
export const outcomeTasks = (outcome, clock = systemClock) => {
    const { id, stamp } = batch(clock, 'reward');
    const magnitude = clamp01(Math.abs(outcome.reward) + 0.1);
    const positive = outcome.reward >= 0;
    const tasks = [
        focusTask({
            id: id('reward', positive ? 'pos' : 'neg'),
            term: rewardTerm(outcome.reward),
            type: 'belief',
            priority: magnitude,
            f: positive ? 1.0 : 0.0,
            c: magnitude,
            stamp: stamp(),
        }),
    ];
    if (outcome.terminal) {
        tasks.push(focusTask({
            id: id('terminal'),
            term: stateTerm('terminal'),
            type: 'belief',
            priority: 0.9,
            f: 1.0,
            c: 0.9,
            stamp: stamp(),
        }));
    }
    return tasks;
};
/** Reflex proposals as executable goals, weighted by {@link expectedValue}. */
export const proposalTasks = (proposals, clock = systemClock) => {
    const { id, stamp } = batch(clock, 'reflex');
    return proposals.map((proposal) => focusTask({
        id: id('goal', proposal.action),
        term: actionTerm(proposal.action, proposal.args ?? {}),
        type: 'goal',
        priority: expectedValue(proposal),
        f: proposal.value,
        c: proposal.confidence,
        stamp: stamp(proposal.source),
    }));
};
