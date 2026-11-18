import { BoundedMap, occupancy, raceDeadline, trimCapped } from '@senars/util';
import type { GateRegistry } from '../kernel/index.js';
import { type IndependenceStatus, Truth } from '../terms/impls/Truth.js';
import type { Task, TruthType } from '../types/core.js';

export type { IndependenceStatus };

export interface LMRequest {
  id: string;
  prompt: string;
  enqueuedAt: number;
  /**
   * Per-request derivation. A producer that needs more than a truth value stages
   * its own provider call here instead of reaching for the batch backend, so the
   * bound, the budget and the overflow policy are the same for both shapes.
   */
  derive?: (request: LMRequest) => Promise<Task[]>;
}

export interface ProvisionalBelief {
  id: string;
  truth: TruthType;
  requestId: string;
  settled: boolean;
  independence?: IndependenceStatus;
}

export interface StreamReasonerOptions {
  /** Injected, never the process global (TODO29.a §4 row 10). */
  gates: GateRegistry;
  maxBatch?: number;
  provisionalConfidence?: number;
  highPressure?: number;
  /** Deepest admissible backlog and the most live provisionals it may hold. */
  maxPending?: number;
  /** The bound on one flush's provider awaits. `Infinity` is not a value this accepts. */
  backendTimeoutMs?: number;
  /** Deepest admissible backlog of settled derivations awaiting the next boundary. */
  maxDerived?: number;
}

export type LMBackend = (requests: LMRequest[]) => Promise<Map<string, TruthType>>;

/**
 * The deepest admissible backlog, and the reason it is a named constant rather
 * than a literal: it is the bound the resource inventory declares
 * (`stream.reasoner-queue`, TODO29.a §5.8), so the inventory points here rather
 * than restating a number that could move.
 */
export const REASONER_QUEUE_CAPACITY = 256;

/** A reasoner holds no proposals of its own beyond these two bounded ledgers. */
export interface StreamReasonerStats {
  queued: number;
  provisionals: number;
  derived: number;
  /** Requests refused by the declared overflow policy — drop-newest. */
  dropped: number;
  /** Requests the backend deadline retired unanswered. */
  timedOut: number;
}

export class StreamReasoner {
  private readonly queue: LMRequest[] = [];
  private readonly provisionals: BoundedMap<string, ProvisionalBelief>;
  private readonly derivedTasks: Task[] = [];
  private seq = 0;
  private dropped = 0;
  private timedOut = 0;
  private readonly gates: GateRegistry;
  private readonly maxBatch: number;
  private readonly maxPending: number;
  private readonly maxDerived: number;
  private readonly backendTimeoutMs: number;
  private readonly provisionalConfidence: number;
  private readonly highPressure: number;

  constructor(opts: StreamReasonerOptions) {
    this.gates = opts.gates;
    this.maxBatch = opts.maxBatch ?? 8;
    this.provisionalConfidence = opts.provisionalConfidence ?? 0.3;
    this.highPressure = opts.highPressure ?? 0.85;
    this.maxPending = opts.maxPending ?? REASONER_QUEUE_CAPACITY;
    this.backendTimeoutMs = opts.backendTimeoutMs ?? 8000;
    this.maxDerived = opts.maxDerived ?? 256;
    this.provisionals = new BoundedMap<string, ProvisionalBelief>({
      maxSize: this.maxPending,
      eviction: 'fifo',
    });
  }

  /**
   * Enqueue work for the next flush. Returns `null` when the declared overflow
   * policy refused it: a full backlog drops the *newest* request, because the
   * queued ones already paid for their place and dropping them would refund a
   * decision the system has already acted on.
   */
  dispatch(
    prompt: string,
    prior?: TruthType,
    derive?: LMRequest['derive']
  ): ProvisionalBelief | null {
    const id = `lm-${++this.seq}`;
    if (this.queue.length >= this.maxPending) {
      this.dropped++;
      return null;
    }
    this.queue.push({ id, prompt, enqueuedAt: Date.now(), derive });
    const provisional: ProvisionalBelief = {
      id: `prov-${id}`,
      truth: { f: prior?.f ?? 0.5, c: this.provisionalConfidence } as TruthType,
      requestId: id,
      settled: false,
    };
    this.provisionals.set(id, provisional);
    return provisional;
  }

  pending(): number {
    return this.queue.length;
  }

  /** Occupancy of the deepest backlog — the signal a caller backpressures on. */
  pressure(): number {
    return occupancy(Math.max(this.queue.length, this.provisionals.size()), this.maxPending);
  }

  stats(): StreamReasonerStats {
    return {
      queued: this.queue.length,
      provisionals: this.provisionals.size(),
      derived: this.derivedTasks.length,
      dropped: this.dropped,
      timedOut: this.timedOut,
    };
  }

  async flush(backend: LMBackend, pressure: number): Promise<ProvisionalBelief[]> {
    if (pressure >= this.highPressure) return [];
    const batch = this.queue.splice(0, this.maxBatch);
    if (batch.length === 0) return [];
    if (
      !this.gates.getBudgetGate().check({ operation: 'lm-call', estimatedCost: batch.length })
        .granted
    ) {
      this.queue.unshift(...batch);
      trimCapped(this.queue, this.maxPending);
      return [];
    }
    const answered = new Map<string, TruthType>();
    const outcome = await raceDeadline(
      this.runBatch(backend, batch, answered),
      this.backendTimeoutMs
    );
    if (outcome.timedOut) {
      // The batch is retired, not retried: a provider that misses the deadline
      // would otherwise make the backlog older and no larger.
      this.timedOut += batch.length;
      for (const req of batch) this.provisionals.delete(req.id);
      return [];
    }
    return batch.flatMap((req) => {
      const prov = this.provisionals.peek(req.id);
      this.provisionals.delete(req.id);
      const truth = answered.get(req.id);
      if (!truth || !prov) return [];
      if (prov.independence === 'unknown') return [];
      prov.truth = Truth.revision(prov.truth, truth);
      prov.settled = true;
      return [prov];
    });
  }

  /** Derivations settled since the last boundary; the outbox the cycle drains. */
  takeDerived(): Task[] {
    return this.derivedTasks.splice(0, this.derivedTasks.length);
  }

  private async runBatch(
    backend: LMBackend,
    batch: readonly LMRequest[],
    answered: Map<string, TruthType>
  ): Promise<void> {
    const deriving = batch.filter((req) => req.derive);
    const queried = batch.filter((req) => !req.derive);
    if (queried.length > 0) {
      for (const [id, truth] of await backend(queried)) answered.set(id, truth);
    }
    for (const req of deriving) {
      const tasks = (await req.derive!(req)) ?? [];
      this.derivedTasks.push(...tasks);
      trimCapped(this.derivedTasks, this.maxDerived);
    }
  }
}
