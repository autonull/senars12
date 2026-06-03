import type {NAR} from '../nar/nar.js';
import {EventBus} from '../nar/types/events.js';

export interface SchedulerInsight {
    term: string;
    truth?: {frequency: number; confidence: number};
    ts: number;
    provenance: 'derivation' | 'belief_added' | 'reasoning';
    derived?: boolean;
}

export interface SchedulerConfig {
    reasoningStepsPerWake: number;
    wakeupIntervalMs: number;
    sleepIntervalMs: number;
    enableLMRules: boolean;
    effortLevel: number;
    ringBufferSize?: number;
}

interface BeliefLike {
    term: {toString(): string};
    truth?: {f: number; c: number};
    derived?: boolean;
}

/**
 * AutonomousScheduler — a first-class reasoning stream (Phase 7).
 *
 * The scheduler runs NARS inference on a periodic wake cycle, emits
 * derived insights on its `EventBus`, and exposes them via a bounded
 * ring buffer so chat-side code can pull them without coupling to the
 * bus protocol.
 *
 * The buffer is bounded (default 256) and oldest-evicted; insights are
 * not persisted beyond the lifecycle of the scheduler.
 */
export class AutonomousScheduler {
    private nar: NAR;
    private config: SchedulerConfig;
    private lastInputTime = Date.now();
    private wakeTimer?: ReturnType<typeof setInterval>;
    private running = false;
    public eventBus = new EventBus();
    private insights: SchedulerInsight[] = [];
    private ringSize: number;

    constructor(nar: NAR, config: SchedulerConfig) {
        this.nar = nar;
        this.config = config;
        this.ringSize = config.ringBufferSize ?? 256;
    }

    markUserInput(): void {
        this.lastInputTime = Date.now();
    }

    start(): void {
        this.stop();
        this.wakeTimer = setInterval(() => { void this.checkAndRun(); }, this.config.wakeupIntervalMs);
        if (typeof this.wakeTimer?.unref === 'function') this.wakeTimer.unref();
    }

    stop(): void {
        if (this.wakeTimer !== undefined) {
            clearInterval(this.wakeTimer);
            this.wakeTimer = undefined;
        }
    }

    /** Insert insights, evicting the oldest past `ringSize`. */
    recordInsights(items: SchedulerInsight[]): void {
        if (items.length === 0) return;
        this.insights.push(...items);
        if (this.insights.length > this.ringSize) {
            this.insights.splice(0, this.insights.length - this.ringSize);
        }
    }

    /**
     * Get the most recent N insights, optionally filtered by age in ms.
     * Returns the items in chronological order (oldest first).
     */
    getRecentInsights(limit = 8, sinceMs?: number): SchedulerInsight[] {
        const now = Date.now();
        const floor = sinceMs === undefined ? 0 : now - sinceMs;
        return this.insights.filter(i => i.ts >= floor).slice(-limit);
    }

    size(): number {
        return this.insights.length;
    }

    clear(): void {
        this.insights.length = 0;
    }

    /**
     * Run a single wake cycle immediately. Returns the number of insights
     * produced. Used by tests to drive the scheduler synchronously and by
     * chat-side code to force a cycle.
     */
    async tick(): Promise<number> {
        return await this.runCycle();
    }

    private async checkAndRun(): Promise<void> {
        if (this.running) return;
        const idle = Date.now() - this.lastInputTime;
        if (idle < this.config.sleepIntervalMs) return;
        await this.runCycle();
    }

    private async runCycle(): Promise<number> {
        this.running = true;
        try {
            const cycles = Math.ceil(this.config.effortLevel * this.config.reasoningStepsPerWake);
            if (cycles <= 0) return 0;
            const derived = await this.nar.run(cycles);
            if (derived <= 0) return 0;
            const fresh = this.captureRecent(derived);
            this.recordInsights(fresh);
            this.eventBus.emit('scheduler:insights', {derived, insights: fresh});
            return fresh.length;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.eventBus.emit('scheduler:error', {error: message});
            return 0;
        } finally {
            this.running = false;
        }
    }

    private captureRecent(derived: number): SchedulerInsight[] {
        const beliefs = this.nar.getBeliefs() as BeliefLike[];
        const slice = beliefs.slice(-Math.min(derived, 5));
        const ts = Date.now();
        return slice.map(b => {
            const out: SchedulerInsight = {
                term: b.term.toString(),
                ts,
                provenance: b.derived ? 'derivation' : 'belief_added',
            };
            if (b.truth) out.truth = {frequency: b.truth.f, confidence: b.truth.c};
            if (b.derived !== undefined) out.derived = b.derived;
            return out;
        });
    }
}
