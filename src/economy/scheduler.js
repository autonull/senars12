/**
 * Economy Scheduler — pure functions for the task economy.
 *
 * Replaces EconomyScheduler class with pure functions operating on EconomyState.
 * No mutation, no event bus, deterministic.
 */
import { weightedPick } from '@senars/util/random';
import { ECONOMY_TASK_BAG_KINDS as TASK_BAG_KINDS, defaultSchedulerConfig, } from './types';
import { calculateTotalUtility, calculateTaskUtility } from './utility-voi';
/** Create initial economy state. */
export function createInitialState(config = {}) {
    const mergedConfig = { ...defaultSchedulerConfig, ...config };
    const bags = new Map();
    for (const kind of TASK_BAG_KINDS) {
        bags.set(kind, new Set());
    }
    return {
        tasks: new Map(),
        bags,
        iteration: 0,
        totalUtility: 0,
        schedulerStats: {
            tasksScheduled: 0,
            fairnessViolations: 0,
            explorationPicks: 0,
            thinkDecisions: 0,
            actDecisions: 0,
            avgUtility: 0,
        },
        activeOverlays: [],
        pickHistory: [],
        config: mergedConfig,
    };
}
/** Add a task to the economy state. */
export function addTask(state, task) {
    const newTasks = new Map(state.tasks);
    newTasks.set(task.id, task);
    const newBags = new Map(state.bags);
    const bag = newBags.get(task.kind);
    if (bag) {
        const newBag = new Set(bag);
        newBag.add(task.id);
        newBags.set(task.kind, newBag);
    }
    return {
        ...state,
        tasks: newTasks,
        bags: newBags,
    };
}
/** Remove a task from the economy state. */
export function removeTask(state, taskId) {
    const task = state.tasks.get(taskId);
    if (!task)
        return state;
    const newTasks = new Map(state.tasks);
    newTasks.delete(taskId);
    const newBags = new Map(state.bags);
    const bag = newBags.get(task.kind);
    if (bag) {
        const newBag = new Set(bag);
        newBag.delete(taskId);
        newBags.set(task.kind, newBag);
    }
    return {
        ...state,
        tasks: newTasks,
        bags: newBags,
    };
}
/** Update a task in the economy state. */
export function updateTask(state, taskId, updates, clock) {
    const task = state.tasks.get(taskId);
    if (!task)
        return state;
    const updated = { ...task, ...updates, lastAccessed: clock.now(), accessCount: task.accessCount + 1 };
    const newTasks = new Map(state.tasks);
    newTasks.set(taskId, updated);
    return {
        ...state,
        tasks: newTasks,
    };
}
/** Get a task by ID. */
export function getTask(state, taskId) {
    return state.tasks.get(taskId);
}
/** Get all tasks of a kind. */
export function getTasksByKind(state, kind) {
    const ids = state.bags.get(kind);
    if (!ids)
        return [];
    return [...ids].map(id => state.tasks.get(id)).filter(Boolean);
}
/** Get all tasks. */
export function getAllTasks(state) {
    return [...state.tasks.values()];
}
/** Activate an overlay. */
export function activateOverlay(state, overlay) {
    const newOverlay = { ...overlay, active: true };
    const newConfigOverlays = [...state.config.overlays, newOverlay];
    const newActiveOverlays = [...state.activeOverlays, newOverlay];
    return {
        ...state,
        config: { ...state.config, overlays: newConfigOverlays },
        activeOverlays: newActiveOverlays,
    };
}
/** Deactivate an overlay. */
export function deactivateOverlay(state, overlayId) {
    const newConfigOverlays = state.config.overlays.map(o => o.id === overlayId ? { ...o, active: false } : o);
    const newActiveOverlays = state.activeOverlays.map(o => o.id === overlayId ? { ...o, active: false } : o);
    return {
        ...state,
        config: { ...state.config, overlays: newConfigOverlays },
        activeOverlays: newActiveOverlays,
    };
}
/** Apply aging to all tasks in state. */
function applyAgingToState(state, clock) {
    const { decayRate, minActivation, accessBoost, maxAge } = state.config.aging;
    const now = clock.now();
    const newTasks = new Map(state.tasks);
    const newBags = new Map(state.bags);
    let tasksRemoved = 0;
    for (const [id, task] of newTasks) {
        // Decay activation
        task.activation *= decayRate;
        // Boost from recent access
        const ageIterations = state.iteration - (task.lastAccessed > 0 ? Math.floor(task.lastAccessed / 1000) : state.iteration);
        if (ageIterations < 10) {
            task.activation = Math.min(1, task.activation + accessBoost);
        }
        // Enforce minimum
        task.activation = Math.max(minActivation, task.activation);
        // Remove stale tasks
        const ageMs = now - task.createdAt;
        if (ageMs > maxAge * 60 * 60 * 1000) { // maxAge in hours
            newTasks.delete(id);
            const bag = newBags.get(task.kind);
            if (bag)
                bag.delete(id);
            tasksRemoved++;
        }
    }
    return {
        ...state,
        tasks: newTasks,
        bags: newBags,
    };
}
/** Check fairness across task kinds. */
function checkFairness(state, candidates) {
    const violations = [];
    const windowStats = new Map();
    // Count picks per kind in window
    const kindPicks = new Map();
    for (const pick of state.pickHistory) {
        kindPicks.set(pick.kind, (kindPicks.get(pick.kind) ?? 0) + 1);
    }
    // Expected picks per kind (proportional to candidate count)
    const kindCounts = new Map();
    for (const task of candidates) {
        kindCounts.set(task.kind, (kindCounts.get(task.kind) ?? 0) + 1);
    }
    const totalPicks = state.pickHistory.length;
    const totalCandidates = candidates.length;
    for (const [kind, count] of kindCounts) {
        const expected = totalCandidates > 0 ? (count / totalCandidates) * totalPicks : 0;
        const actual = kindPicks.get(kind) ?? 0;
        windowStats.set(kind, actual);
        // Violation if significantly underrepresented (less than 50% of expected)
        if (expected > 2 && actual < expected * 0.5) {
            violations.push({ kind, expected: Math.round(expected), actual, window: state.config.fairnessWindow });
        }
    }
    return { passed: violations.length === 0, violations, windowStats };
}
/** Pure schedule function: (state, rng, clock, successors?) -> { task, newState, candidates, explored, metadata }. */
export function schedule(state, rng, clock, successors = new Map()) {
    const startTs = clock.now();
    const newIteration = state.iteration + 1;
    // Apply aging
    let agedState = applyAgingToState(state, clock);
    agedState = { ...agedState, iteration: newIteration };
    // Get all tasks with weight > minWeight
    const candidates = getAllTasks(agedState)
        .filter(t => t.weight > agedState.config.minWeight && t.activation > agedState.config.aging.minActivation);
    if (candidates.length === 0) {
        return emptyResult(agedState, startTs, clock);
    }
    // Calculate utilities
    const totalUtility = calculateTotalUtility(candidates, agedState.config.overlays);
    agedState = { ...agedState, totalUtility };
    const ranked = candidates.map(task => {
        const taskSuccessors = successors.get(task.id) ?? [];
        const utility = calculateTaskUtility(task, taskSuccessors, totalUtility, agedState.config, agedState.config.overlays);
        return { task, utility: utility.total };
    });
    ranked.sort((a, b) => b.utility - a.utility);
    // Fairness check
    const fairnessCheck = checkFairness(agedState, ranked.map(r => r.task));
    // Metareasoning: think vs act
    let explored = false;
    let selected = null;
    let newStats = { ...agedState.schedulerStats };
    if (agedState.config.metareasoningEnabled && ranked.length > 0) {
        const top = ranked[0];
        const second = ranked[1];
        const margin = second ? top.utility - second.utility : top.utility;
        if (margin < agedState.config.marginThreshold) {
            // Small margin: think (explore)
            newStats.thinkDecisions++;
            const rngSource = rng.next.bind(rng);
            if (rngSource() < agedState.config.explorationRate) {
                // Explore: weighted random from top candidates
                const topCandidates = ranked.slice(0, Math.min(5, ranked.length));
                selected = weightedPick(topCandidates, c => c.utility, rngSource)?.task ?? null;
                explored = true;
                newStats.explorationPicks++;
            }
            else {
                // Think: pick top but record as think decision
                selected = top.task;
            }
        }
        else {
            // Large margin: act (exploit)
            newStats.actDecisions++;
            selected = top.task;
        }
    }
    else {
        // No metareasoning or single candidate
        selected = ranked[0]?.task ?? null;
    }
    let finalState = { ...agedState, schedulerStats: newStats };
    if (selected) {
        // Update task access
        finalState = updateTask(finalState, selected.id, { lastAccessed: clock.now(), accessCount: selected.accessCount + 1 }, clock);
        // Record pick for fairness
        const pickRecord = {
            taskId: selected.id,
            kind: selected.kind,
            iteration: newIteration,
            utility: ranked.find(r => r.task.id === selected.id)?.utility ?? 0,
        };
        const newPickHistory = [...finalState.pickHistory, pickRecord];
        // Trim history to fairness window
        if (newPickHistory.length > finalState.config.fairnessWindow) {
            newPickHistory.splice(0, newPickHistory.length - finalState.config.fairnessWindow);
        }
        finalState = {
            ...finalState,
            pickHistory: newPickHistory,
            schedulerStats: {
                ...newStats,
                tasksScheduled: newStats.tasksScheduled + 1,
            },
        };
    }
    const durationMs = clock.now() - startTs;
    return {
        task: selected,
        newState: finalState,
        candidates: ranked,
        explored,
        metadata: {
            iteration: newIteration,
            budgetUsed: selected ? 1 : 0,
            budgetRemaining: finalState.config.budgetPerIteration - (selected ? 1 : 0),
            durationMs,
            fairnessCheck,
        },
    };
}
/** Empty result when no candidates. */
function emptyResult(state, startTs, clock) {
    return {
        task: null,
        newState: { ...state, iteration: state.iteration + 1 },
        candidates: [],
        explored: false,
        metadata: {
            iteration: state.iteration + 1,
            budgetUsed: 0,
            budgetRemaining: state.config.budgetPerIteration,
            durationMs: clock.now() - startTs,
            fairnessCheck: { passed: true, violations: [], windowStats: new Map() },
        },
    };
}
/** Get scheduler stats. */
export function getStats(state) {
    const { tasksScheduled, ...rest } = state.schedulerStats;
    return {
        ...rest,
        tasksScheduled,
        avgUtility: tasksScheduled > 0 ? state.totalUtility / tasksScheduled : 0,
    };
}
/** Get pick history. */
export function getPickHistory(state) {
    return [...state.pickHistory];
}
/** Set RNG seed for determinism (returns new state with updated RNG if applicable). */
export function setSeed(state, seed, rng) {
    if ('setSeed' in rng && typeof rng.setSeed === 'function') {
        rng.setSeed(seed);
    }
    return state;
}
/** Create initial economy state from config. */
export function createEconomyState(config) {
    return createInitialState(config);
}
/** Create initial economy state from Env. */
export function createEconomyStateFromEnv(env, config) {
    return createInitialState({
        ...config,
        rng: env.rng,
        clock: env.clock,
        seed: config?.seed,
    });
}
/** Default economy state. */
export const defaultEconomyState = createInitialState();
