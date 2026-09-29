import { BoundedMap, occupancy } from '@senars/util';
import { gateRegistry } from '../kernel/index.js';
import { type IndependenceStatus, Truth } from '../terms/truth.js';
import type { TickContext } from '../tick/tick.js';
import type { Task, TruthType } from '../types/core.js';
import { pushCapped, trimCapped } from '../utils/collections.js';

export type { IndependenceStatus };

export interface LMRequest {
  id: string;
  prompt: string;
  enqueuedAt: number;
}

export interface ProvisionalBelief {
  id: string;
  truth: TruthType;
  requestId: string;
  settled: boolean;
  independence?: IndependenceStatus;
}

export interface StreamReasonerOptions {
  maxBatch?: number;
  provisionalConfidence?: number;
  highPressure?: number;
  /** Deepest admissible backlog and the most live provisionals it may hold. */
  maxPending?: number;
}

export type LMBackend = (requests: LMRequest[]) => Promise<Map<string, TruthType>>;

export class StreamReasoner {
  private readonly queue: LMRequest[] = [];
  private readonly provisionals: BoundedMap<string, ProvisionalBelief>;
  private seq = 0;
  private readonly maxBatch: number;
  private readonly maxPending: number;
  private readonly provisionalConfidence: number;
  private readonly highPressure: number;

  constructor(opts: StreamReasonerOptions = {}) {
    this.maxBatch = opts.maxBatch ?? 8;
    this.provisionalConfidence = opts.provisionalConfidence ?? 0.3;
    this.highPressure = opts.highPressure ?? 0.85;
    this.maxPending = opts.maxPending ?? 256;
    this.provisionals = new BoundedMap<string, ProvisionalBelief>({
      maxSize: this.maxPending,
      eviction: 'fifo',
    });
  }

  dispatch(prompt: string, prior?: TruthType): ProvisionalBelief {
    const id = `lm-${++this.seq}`;
    pushCapped(this.queue, { id, prompt, enqueuedAt: Date.now() }, this.maxPending);
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
    return occupancy(Math.max(this.queue.length, this.provisionals.size), this.maxPending);
  }

  async flush(backend: LMBackend, pressure: number): Promise<ProvisionalBelief[]> {
    if (pressure >= this.highPressure) return [];
    const batch = this.queue.splice(0, this.maxBatch);
    if (batch.length === 0) return [];
    if (
      !gateRegistry.getBudgetGate().check({ operation: 'lm-call', estimatedCost: batch.length })
        .granted
    ) {
      this.queue.unshift(...batch);
      trimCapped(this.queue, this.maxPending);
      return [];
    }
    const resolved = await backend(batch);
    return batch.flatMap((req) => {
      const prov = this.provisionals.peek(req.id);
      this.provisionals.delete(req.id);
      const truth = resolved.get(req.id);
      if (!truth || !prov) return [];
      if (prov.independence === 'unknown') return [];
      prov.truth = Truth.revision(prov.truth, truth);
      prov.settled = true;
      return [prov];
    });
  }

  reasonHook(backend: LMBackend, pressureOf?: () => number): (ctx: TickContext) => Promise<void> {
    return async (ctx) => {
      const settled = await this.flush(backend, pressureOf?.() ?? 0);
      for (const prov of settled) ctx.state.derivations.push(prov as unknown as Task);
    };
  }
}
