import type {AutonomousScheduler, SchedulerInsight} from '../AutonomousScheduler.js';

export type InsightListener = (insight: SchedulerInsight) => void;

/**
 * InsightStream — a thin pub/sub wrapper over `AutonomousScheduler`'s
 * ring buffer (Phase 7, invariant I9).
 *
 * The chat path consumes insights by `pull()` (cheap O(1) bounded query
 * against the scheduler's ring buffer). Subscribers receive every newly
 * recorded insight via the scheduler's own `eventBus`, so multiple
 * consumers (ConnectionManager broadcasts, working-memory incorporation)
 * stay decoupled.
 */
export class InsightStream {
    private readonly scheduler: AutonomousScheduler;
    private readonly bus = (): {on: (e: string, h: InsightListener) => void} => this.scheduler.eventBus as unknown as {on: (e: string, h: InsightListener) => void};

    constructor(scheduler: AutonomousScheduler) {
        this.scheduler = scheduler;
    }

    onInsight(listener: InsightListener): () => void {
        const handler = (data: unknown) => {
            const payload = data as {insights?: SchedulerInsight[]};
            const items = payload?.insights ?? [];
            for (const i of items) listener(i);
        };
        const unsub = this.scheduler.eventBus.on('scheduler:insights', handler as never);
        return () => unsub();
    }

    pull(limit = 8, sinceMs?: number): SchedulerInsight[] {
        return this.scheduler.getRecentInsights(limit, sinceMs);
    }

    size(): number {
        return this.scheduler.size();
    }
}
