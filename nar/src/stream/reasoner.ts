import { Truth } from '../terms/truth.js';
import type { Task, TruthType } from '../types/core.js';
import type { TickContext } from '../tick/tick.js';

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
}

export interface StreamReasonerOptions {
  maxBatch?: number;
  provisionalConfidence?: number;
  highPressure?: number;
}

export type LMBackend = (requests: LMRequest[]) => Promise<Map<string, TruthType>>;

export class StreamReasoner {
  private readonly queue: LMRequest[] = [];
  private readonly provisionals = new Map<string, ProvisionalBelief>();
  private seq = 0;
  private readonly maxBatch: number;
  private readonly provisionalConfidence: number;
  private readonly highPressure: number;

  constructor(opts: StreamReasonerOptions = {}) {
    this.maxBatch = opts.maxBatch ?? 8;
    this.provisionalConfidence = opts.provisionalConfidence ?? 0.3;
    this.highPressure = opts.highPressure ?? 0.85;
  }

  dispatch(prompt: string, prior?: TruthType): ProvisionalBelief {
    const id = `lm-${++this.seq}`;
    this.queue.push({ id, prompt, enqueuedAt: Date.now() });
    const provisional: ProvisionalBelief = {
      id: `prov-${id}`,
      truth: { f: prior?.f ?? 0.5, c: this.provisionalConfidence },
      requestId: id,
      settled: false,
    };
    this.provisionals.set(provisional.id, provisional);
    return provisional;
  }

  pending(): number {
    return this.queue.length;
  }

  async flush(backend: LMBackend, pressure: number): Promise<ProvisionalBelief[]> {
    if (pressure >= this.highPressure) return [];
    const batch = this.queue.splice(0, this.maxBatch);
    if (batch.length === 0) return [];
    const resolved = await backend(batch);
    return batch.flatMap((req) => {
      const truth = resolved.get(req.id);
      const prov = [...this.provisionals.values()].find((p) => p.requestId === req.id);
      if (!truth || !prov) return [];
      prov.truth = Truth.revision(prov.truth, truth);
      prov.settled = true;
      return [prov];
    });
  }

  dropLowPriority(keep: number): number {
    const dropped = Math.max(0, this.queue.length - keep);
    this.queue.splice(0, dropped);
    return dropped;
  }

  reasonHook(backend: LMBackend, pressureOf?: () => number): (ctx: TickContext) => Promise<void> {
    return async (ctx) => {
      const settled = await this.flush(backend, pressureOf?.() ?? 0);
      for (const prov of settled) ctx.state.derivations.push(prov as unknown as Task);
    };
  }
}
