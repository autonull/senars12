/**
 * Scheduler — the one scheduler that samples one Focus by weight.
 *
 * No parallel drive machinery. One scheduler samples one `Focus` by weight;
 * no parallel drive machinery exists.
 */

import { weightedPick, SeededRNG } from '@senars/util/random';
import {
  EconomyTask,
  TaskBagKind,
  TaskSource,
  SchedulerConfig,
  SchedulerStats,
  EconomyState,
  EconomyEvent,
  EconomyEventType,
  Overlay,
  AgingPolicy,
  TASK_BAG_KINDS,
  ECONOMY_EVENTS,
  defaultSchedulerConfig,
} from './types.js';
import type { Truth } from '../kernel/truth.js';
import { calculateTaskUtility, calculateTotalUtility } from './utility.js';
import { Successor } from './types.js';

/** Scheduler result. */
export interface SchedulerResult {
  /** Selected task. */
  task: EconomyTask | null;
  /** All candidates with utilities. */
  candidates: Array<{ task: EconomyTask; utility: number }>;
  /** Whether this was an exploration pick. */
  explored: boolean;
  /** Scheduler metadata. */
  metadata: {
    iteration: number;
    budgetUsed: number;
    budgetRemaining: number;
    durationMs: number;
    fairnessCheck: FairnessCheck;
  };
}

/** Fairness check result. */
export interface FairnessCheck {
  /** Passed. */
  passed: boolean;
  /** Violations. */
  violations: FairnessViolation[];
  /** Window stats. */
  windowStats: Map<string, number>;
}

/** Fairness violation. */
export interface FairnessViolation {
  /** Task kind that was starved. */
  kind: TaskBagKind;
  /** Expected minimum picks. */
  expected: number;
  /** Actual picks. */
  actual: number;
  /** Window size. */
  window: number;
}

/** Task pick record for fairness tracking. */
interface PickRecord {
  taskId: string;
  kind: TaskBagKind;
  iteration: number;
  utility: number;
}

/** Economy scheduler. */
export class EconomyScheduler {
  private config: SchedulerConfig;
  private rng: SeededRNG;
  private clock: { now(): number };
  private state: EconomyState;
  private pickHistory: PickRecord[] = [];
  private eventListeners: Map<EconomyEventType, Set<(event: EconomyEvent) => void>> = new Map();
  private iteration = 0;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...defaultSchedulerConfig, ...config };
    this.rng = new SeededRNG(this.config.seed ?? 1);
    this.clock = this.config.clock ?? { now: () => Date.now() };
    this.state = this.createInitialState();
    this.initializeEventListeners();
  }

  private createInitialState(): EconomyState {
    const bags = new Map<TaskBagKind, Set<string>>();
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
    };
  }

  private initializeEventListeners(): void {
    for (const eventType of ECONOMY_EVENTS) {
      this.eventListeners.set(eventType, new Set());
    }
  }

  /** Add a task to the economy. */
  addTask(task: EconomyTask): void {
    this.state.tasks.set(task.id, task);
    const bag = this.state.bags.get(task.kind);
    if (bag) bag.add(task.id);
    this.emit('task_added', task.id, { kind: task.kind, source: task.source });
  }

  /** Remove a task from the economy. */
  removeTask(taskId: string): boolean {
    const task = this.state.tasks.get(taskId);
    if (!task) return false;

    this.state.tasks.delete(taskId);
    const bag = this.state.bags.get(task.kind);
    if (bag) bag.delete(taskId);
    this.emit('task_removed', taskId, { kind: task.kind });
    return true;
  }

  /** Update a task. */
  updateTask(taskId: string, updates: Partial<EconomyTask>): boolean {
    const task = this.state.tasks.get(taskId);
    if (!task) return false;

    const updated = { ...task, ...updates, lastAccessed: this.clock.now(), accessCount: task.accessCount + 1 };
    this.state.tasks.set(taskId, updated);
    this.emit('task_updated', taskId, updates);
    return true;
  }

  /** Get a task by ID. */
  getTask(taskId: string): EconomyTask | undefined {
    return this.state.tasks.get(taskId);
  }

  /** Get all tasks of a kind. */
  getTasksByKind(kind: TaskBagKind): EconomyTask[] {
    const ids = this.state.bags.get(kind);
    if (!ids) return [];
    return [...ids].map(id => this.state.tasks.get(id)!).filter(Boolean);
  }

  /** Get all tasks. */
  getAllTasks(): EconomyTask[] {
    return [...this.state.tasks.values()];
  }

  /** Schedule one task for the next iteration. */
  schedule(successors: Map<string, Successor[]> = new Map()): SchedulerResult {
    const startTs = this.clock.now();
    this.iteration++;
    this.state.iteration = this.iteration;

    // Apply aging
    this.applyAging();

    // Get all tasks with weight > minWeight
    const candidates = this.getAllTasks()
      .filter(t => t.weight > this.config.minWeight && t.activation > this.config.aging.minActivation);

    if (candidates.length === 0) {
      return this.emptyResult(startTs);
    }

    // Calculate utilities
    const totalUtility = calculateTotalUtility(candidates, this.config.overlays);
    this.state.totalUtility = totalUtility;

    const ranked = candidates.map(task => {
      const taskSuccessors = successors.get(task.id) ?? [];
      const utility = calculateTaskUtility(task, taskSuccessors, totalUtility, this.config, this.config.overlays);
      return { task, utility: utility.total };
    });

    ranked.sort((a, b) => b.utility - a.utility);

    // Fairness check
    const fairnessCheck = this.checkFairness(ranked.map(r => r.task));

    // Metareasoning: think vs act
    let explored = false;
    let selected: EconomyTask | null = null;

    if (this.config.metareasoningEnabled && ranked.length > 0) {
      const top = ranked[0]!;
      const second = ranked[1];
      const margin = second ? top.utility - second.utility : top.utility;

      if (margin < this.config.marginThreshold) {
        // Small margin: think (explore)
        this.state.schedulerStats.thinkDecisions++;
        if (this.rng.source() < this.config.explorationRate) {
          // Explore: weighted random from top candidates
          const topCandidates = ranked.slice(0, Math.min(5, ranked.length));
          selected = weightedPick(topCandidates, c => c.utility, this.rng.source)?.task ?? null;
          explored = true;
          this.state.schedulerStats.explorationPicks++;
        } else {
          // Think: pick top but record as think decision
          selected = top.task;
        }
      } else {
        // Large margin: act (exploit)
        this.state.schedulerStats.actDecisions++;
        selected = top.task;
      }
    } else {
      // No metareasoning or single candidate
      selected = ranked[0]?.task ?? null;
    }

    if (selected) {
      // Update task access
      this.updateTask(selected.id, { lastAccessed: this.clock.now(), accessCount: selected.accessCount + 1 });

      // Record pick for fairness
      this.pickHistory.push({
        taskId: selected.id,
        kind: selected.kind,
        iteration: this.iteration,
        utility: ranked.find(r => r.task.id === selected.id)?.utility ?? 0,
      });

      // Trim history to fairness window
      if (this.pickHistory.length > this.config.fairnessWindow) {
        this.pickHistory = this.pickHistory.slice(-this.config.fairnessWindow);
      }

      this.state.schedulerStats.tasksScheduled++;
      this.emit('task_scheduled', selected.id, { utility: ranked.find(r => r.task.id === selected.id)?.utility });
    }

    const durationMs = this.clock.now() - startTs;

    return {
      task: selected,
      candidates: ranked,
      explored,
      metadata: {
        iteration: this.iteration,
        budgetUsed: selected ? 1 : 0,
        budgetRemaining: this.config.budgetPerIteration - (selected ? 1 : 0),
        durationMs,
        fairnessCheck,
      },
    };
  }

  /** Apply aging to all tasks. */
  private applyAging(): void {
    const { decayRate, minActivation, accessBoost, maxAge } = this.config.aging;
    const now = this.clock.now();

    for (const task of this.state.tasks.values()) {
      // Decay activation
      task.activation *= decayRate;

      // Boost from recent access
      const ageIterations = this.iteration - (task.lastAccessed > 0 ? task.lastAccessed : this.iteration);
      if (ageIterations < 10) {
        task.activation = Math.min(1, task.activation + accessBoost);
      }

      // Enforce minimum
      task.activation = Math.max(minActivation, task.activation);

      // Remove stale tasks
      const ageMs = now - task.createdAt;
      if (ageMs > maxAge * 60 * 60 * 1000) { // maxAge in hours
        this.removeTask(task.id);
      }
    }
  }

  /** Check fairness across task kinds. */
  private checkFairness(candidates: EconomyTask[]): FairnessCheck {
    const violations: FairnessViolation[] = [];
    const windowStats = new Map<string, number>();

    // Count picks per kind in window
    const kindPicks = new Map<TaskBagKind, number>();
    for (const pick of this.pickHistory) {
      kindPicks.set(pick.kind, (kindPicks.get(pick.kind) ?? 0) + 1);
    }

    // Expected picks per kind (proportional to candidate count)
    const kindCounts = new Map<TaskBagKind, number>();
    for (const task of candidates) {
      kindCounts.set(task.kind, (kindCounts.get(task.kind) ?? 0) + 1);
    }

    const totalPicks = this.pickHistory.length;
    const totalCandidates = candidates.length;

    for (const [kind, count] of kindCounts) {
      const expected = totalCandidates > 0 ? (count / totalCandidates) * totalPicks : 0;
      const actual = kindPicks.get(kind) ?? 0;
      windowStats.set(kind, actual);

      // Violation if significantly underrepresented (less than 50% of expected)
      if (expected > 2 && actual < expected * 0.5) {
        violations.push({ kind, expected: Math.round(expected), actual, window: this.config.fairnessWindow });
        this.state.schedulerStats.fairnessViolations++;
        this.emit('fairness_violation', undefined, { kind, expected, actual });
      }
    }

    return { passed: violations.length === 0, violations, windowStats };
  }

  /** Activate an overlay. */
  activateOverlay(overlay: Overlay): void {
    overlay.active = true;
    this.config.overlays.push(overlay);
    this.state.activeOverlays.push(overlay);
    this.emit('overlay_activated', undefined, { overlayId: overlay.id });
  }

  /** Deactivate an overlay. */
  deactivateOverlay(overlayId: string): void {
    const idx = this.config.overlays.findIndex(o => o.id === overlayId);
    if (idx >= 0) {
      const overlay = this.config.overlays[idx];
      if (overlay) overlay.active = false;
    }
    const stateIdx = this.state.activeOverlays.findIndex(o => o.id === overlayId);
    if (stateIdx >= 0) {
      const overlay = this.state.activeOverlays[stateIdx];
      if (overlay) overlay.active = false;
    }
    this.emit('overlay_deactivated', undefined, { overlayId });
  }

  /** Get current state. */
  getState(): EconomyState {
    return { ...this.state };
  }

  /** Get scheduler stats. */
  getStats(): SchedulerStats {
    const { tasksScheduled, ...rest } = this.state.schedulerStats;
    return {
      ...rest,
      tasksScheduled,
      avgUtility: tasksScheduled > 0 ? this.state.totalUtility / tasksScheduled : 0,
    };
  }

  /** Get pick history. */
  getPickHistory(): PickRecord[] {
    return [...this.pickHistory];
  }

  /** Set RNG seed for determinism. */
  setSeed(seed: number): void {
    this.rng = new SeededRNG(seed);
  }

  /** Event emission. */
  private emit(type: EconomyEventType, taskId: string | undefined, data: Record<string, unknown>): void {
    const listeners = this.eventListeners.get(type);
    if (!listeners) return;

    const event: EconomyEvent = { type, taskId, iteration: this.iteration, timestamp: this.clock.now(), data };
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /** Subscribe to events. */
  on(type: EconomyEventType, listener: (event: EconomyEvent) => void): () => void {
    const listeners = this.eventListeners.get(type);
    if (!listeners) return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** Empty result when no candidates. */
  private emptyResult(startTs: number): SchedulerResult {
    return {
      task: null,
      candidates: [],
      explored: false,
      metadata: {
        iteration: this.iteration,
        budgetUsed: 0,
        budgetRemaining: this.config.budgetPerIteration,
        durationMs: this.clock.now() - startTs,
        fairnessCheck: { passed: true, violations: [], windowStats: new Map() },
      },
    };
  }
}

/** Create an economy scheduler. */
export function createEconomyScheduler(config?: Partial<SchedulerConfig>): EconomyScheduler {
  return new EconomyScheduler(config);
}

/** Default scheduler instance. */
export const economyScheduler = createEconomyScheduler();