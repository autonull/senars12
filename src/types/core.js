/**
 * Core type definitions for NARS12
 * Single source of truth for foundational types
 */
import { narCoreDefaults } from '../config';
import { Stamp, Truth } from '../terms';
import { canonicalTask } from '../terms/reduce-task';
import { createTimestamp } from './primitives';
export { createDuration, createTimestamp, DEPTH_MAX } from './primitives';
// Default configuration values — one table, so a limit and its default can never disagree.
export const DEFAULT_CONFIG = Object.freeze(narCoreDefaults);
// Result types for operations — canonical definition lives in @senars/util
export { attempt, attemptAsync, err, flatMap, getOrElse, isErr, isOk, map, ok, unwrapOrThrow, } from '@senars/util/result';
// Create Budget object - optimized with defaults
export const createTaskWeight = (priority, durability = 0.8, quality = 0.9, cycles = 0, depth = 0) => Object.freeze({ priority, durability, quality, cycles, depth });
// Pre-allocated neutral budget for performance
export const NEUTRAL_BUDGET = createTaskWeight(0.5);
// Create Task object - optimized
export const createTask = (term, type, truth, budget = NEUTRAL_BUDGET, overrides = {}) => canonicalTask({
    term,
    type,
    truth,
    budget,
    stamp: overrides.stamp ?? Stamp.createInput(),
    occurrenceTime: overrides.occurrenceTime ?? createTimestamp(),
    derived: overrides.derived ?? false,
});
/** Belief task at a concept's priority; `stamp` defaults to a fresh input stamp. */
export const createBeliefTask = (term, truth, priority, stamp) => createTask(term, 'belief', truth, createTaskWeight(priority), stamp ? { stamp } : {});
// Create secondary task from concept or belief - unified replacement for createTaskFromBelief/createTaskFromConcept
export const createSecondaryTask = (term, priority, truth, type = 'belief') => canonicalTask({
    term,
    type,
    truth: truth ?? Truth.NEUTRAL,
    budget: createTaskWeight(priority),
    stamp: Stamp.createInput(),
    occurrenceTime: createTimestamp(0),
    derived: false,
});
// The error taxonomy is declared in `@senars/util` — a leaf package with zero
// workspace dependencies, so both core and nar can depend on it. These are
// re-exports, not aliases: the identity is the same class either way.
export { ConfigurationError, OperationError, ToolError, ValidationError, } from '../errors';
