import type {EpisodeWorkingMemory} from './EpisodeWorkingMemory.js';
import {AgentEventBus} from './AgentEventBus.js';
import type {Goal} from './GoalManager.js';

export interface WMManagerOptions {
    wm: EpisodeWorkingMemory;
    eventBus: AgentEventBus;
}

export class WMManager {
    private readonly wm: EpisodeWorkingMemory;
    private readonly eventBus: AgentEventBus;
    private lastTick = 0;

    constructor(opts: WMManagerOptions) {
        this.wm = opts.wm;
        this.eventBus = opts.eventBus;
    }

    async tick(activeGoal?: Goal): Promise<void> {
        const now = Date.now();
        if (now - this.lastTick < 30_000) return;
        this.lastTick = now;

        const pruned = this.wm.prune();

        const snap = this.wm.snapshot() as Record<string, unknown>;
        const goalKeywords = activeGoal
            ? activeGoal.description.toLowerCase().split(/\s+/).filter(w => w.length > 3)
            : [];

        for (const [name] of Object.entries(snap)) {
            let score = 0.5;
            if (goalKeywords.length > 0) {
                const nameMatch = goalKeywords.some(k => name.toLowerCase().includes(k));
                score = nameMatch ? 1.0 : 0.3;
            }
            if (score >= 0.8) {
                this.wm.touch(name);
            }
        }
    }
}
