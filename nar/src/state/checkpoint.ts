/**
 * Rewind checkpoints (CORE.19 C2.3).
 *
 * A rewind is *declared-partial*: the kernel can step forward but its graph is
 * not journaled per cycle, so going back means restoring the nearest state it
 * bothered to keep. This module owns that kept state — a bounded ring of
 * checkpoints, each the whole graph (a memory dump) plus the persistence
 * boundary fields (C4.1) that live outside memory — and the orchestration that
 * restores one.
 *
 * The boundary is the same one a restart resumes, minus the fields it never had
 * (RNG state) and the rings a snapshot cannot reach. What is *not* restored is
 * reported rather than implied — the difference between a declared gap and a lie.
 */

import { BoundedRing, currentIdCount, primeIdCount } from '@senars/util';
import type { ConceptWriter } from '../memory/ports/index.js';
import { deserialize, serialize, type SerializedMemory } from '../memory/state/serialization.js';
import { rehydrateTask, serializeTaskRecord, type TaskRecord } from '../task/record.js';
import type { Task } from '../types/index.js';
import type { ConsistencyBoundary } from './boundary.js';

/**
 * How many checkpoints a rewind can reach. The ring caps the memory a rewind
 * costs; the oldest is displaced under `drop-oldest`, so the reachable window is
 * the newest `CHECKPOINT_RING_CAP` captures.
 */
export const CHECKPOINT_RING_CAP = 64;

/** Cycles between automatic checkpoints when the kernel is not configured otherwise. */
export const DEFAULT_CHECKPOINT_INTERVAL = 10;

/** A captured kernel state: the graph as a memory dump, plus the boundary fields. */
export interface KernelCheckpoint {
  cycle: number;
  memory: SerializedMemory;
  boundary: ConsistencyBoundary;
}

/**
 * What a rewind resumed, and what it did not. `restored` is the cycle the kernel
 * actually stands at after the rewind — the target when a checkpoint lands on it,
 * the nearest earlier checkpoint otherwise. `gaps` names the state the kernel
 * deliberately did not restore.
 */
export interface RewindReport {
  from: number;
  target: number;
  restored: number;
  checkpointed: boolean;
  concepts: number;
  gaps: string[];
}

/** The state a snapshot cannot reach, declared once and reported on every rewind. */
export const REWIND_BASE_GAPS: readonly string[] = [
  'RNG state is not restored: the stream is a caller-injected RandomSource, not a value the kernel owns',
  'the gate-event, rule-fire and derivation rings are not rewound',
  'the durable event log is append-only; a rewind does not truncate it',
  'drive intensities and learned rule-table revisions are not part of the checkpoint',
];

/**
 * The kernel operations a checkpoint round-trips. The NAR owns the kernel, the
 * queue, the id ledger and the store, so it names the one operation of each
 * rather than this module reaching into them.
 */
export interface KernelRewindPorts {
  /** The graph now, as a memory dump. */
  snapshot(): SerializedMemory;
  /** Replace the graph with a dump. */
  restore(dump: SerializedMemory): Promise<void>;
  getCycleCount(): number;
  setCycleCount(count: number): void;
  /** The pending queue now. */
  pendingTasks(): Task[];
  /** Drop the pending queue, ahead of `restorePending`. */
  clearPending(): void;
  /** Re-queue restored pending tasks. */
  restorePending(records: TaskRecord[]): void;
  idHighWater(): number;
  primeIdHighWater(count: number): void;
}

/** The live pieces a kernel rewind reaches through — the NAR, structurally. */
export interface KernelRewindStore {
  getPending(): Task[];
  clearPending(): void;
  addTask(task: Task): void;
}

export interface KernelRewindClock {
  getCycleCount(): number;
  setCycleCount(count: number): void;
}

/** Bounded ring of checkpoints, newest last. */
export class KernelCheckpointRing {
  readonly #ring = new BoundedRing<KernelCheckpoint>(CHECKPOINT_RING_CAP);

  /** Snapshot the graph and boundary at `cycle`; returns the checkpoint kept. */
  capture(cycle: number, snapshot: SerializedMemory, boundary: ConsistencyBoundary): KernelCheckpoint {
    const checkpoint: KernelCheckpoint = { cycle, memory: snapshot, boundary };
    this.#ring.push(checkpoint);
    return checkpoint;
  }

  /** The newest checkpoint at or before `cycle`; `undefined` when none is reachable. */
  atOrBefore(cycle: number): KernelCheckpoint | undefined {
    let best: KernelCheckpoint | undefined;
    for (const checkpoint of this.#ring.toArray()) {
      if (checkpoint.cycle <= cycle && (!best || checkpoint.cycle > best.cycle)) best = checkpoint;
    }
    return best;
  }

  get size(): number {
    return this.#ring.size();
  }

  clear(): void {
    this.#ring.clear();
  }
}

/**
 * The kernel's rewind capability: capture checkpoints on the kernel's own clock,
 * and restore the nearest one toward a target cycle. Orchestration lives here so
 * the NAR facade only wires ports and re-emits the report.
 */
export class KernelRewind {
  readonly #ring = new KernelCheckpointRing();

  constructor(
    private readonly ports: KernelRewindPorts,
    private readonly interval: number
  ) {}

  get size(): number {
    return this.#ring.size;
  }

  /** Snapshot the graph when the checkpoint interval has elapsed. */
  maybeCapture(cycle: number): void {
    if (this.interval <= 0 || cycle % this.interval !== 0) return;
    this.#ring.capture(cycle, this.ports.snapshot(), {
      cycleCount: cycle,
      pendingTasks: this.ports.pendingTasks().map(serializeTaskRecord),
      idHighWater: this.ports.idHighWater(),
    });
  }

  /**
   * Restore the newest checkpoint at or before `cycleCount - cycles`: the graph
   * and the boundary fields, then report the state not restored. Never implies a
   * full restore.
   */
  async rewind(cycles = 1): Promise<RewindReport> {
    const from = this.ports.getCycleCount();
    const target = Math.max(0, from - Math.max(0, Math.floor(cycles)));
    const checkpoint = this.#ring.atOrBefore(target);
    if (!checkpoint) {
      return {
        from,
        target,
        restored: from,
        checkpointed: false,
        concepts: 0,
        gaps: [...REWIND_BASE_GAPS, 'no checkpoint at or before the target cycle'],
      };
    }
    await this.ports.restore(checkpoint.memory);
    this.ports.clearPending();
    this.ports.restorePending(checkpoint.boundary.pendingTasks);
    this.ports.setCycleCount(checkpoint.cycle);
    this.ports.primeIdHighWater(checkpoint.boundary.idHighWater);
    const gaps = [...REWIND_BASE_GAPS];
    if (checkpoint.cycle !== target)
      gaps.push(
        `nearest checkpoint at cycle ${checkpoint.cycle}; the interval to the target was not journaled`
      );
    return {
      from,
      target,
      restored: checkpoint.cycle,
      checkpointed: true,
      concepts: checkpoint.memory.statistics.totalConcepts,
      gaps,
    };
  }
}

/** Build the kernel's rewind from the NAR's live pieces — one wiring, not a facade method. */
export const createKernelRewind = (
  memory: ConceptWriter,
  taskManager: KernelRewindStore,
  execution: KernelRewindClock,
  checkpointInterval?: number
): KernelRewind =>
  new KernelRewind(
    {
      snapshot: () => serialize(memory),
      restore: (dump) => deserialize(dump, memory),
      getCycleCount: () => execution.getCycleCount(),
      setCycleCount: (count) => execution.setCycleCount(count),
      pendingTasks: () => taskManager.getPending(),
      clearPending: () => taskManager.clearPending(),
      restorePending: (records) => {
        for (const record of records) {
          const task = rehydrateTask(record, record.type ?? 'belief');
          if (task) taskManager.addTask(task);
        }
      },
      idHighWater: () => currentIdCount(),
      primeIdHighWater: (count) => primeIdCount(count),
    },
    checkpointInterval ?? DEFAULT_CHECKPOINT_INTERVAL
  );
