import {EventBus} from '../../nar/types/events.js';
import type {SchedulerInsight} from '../AutonomousScheduler.js';
import type {InsightStream} from '../autonomy/InsightStream.js';
import type {Route} from '../types.js';
import {route} from '../routing/InputRouter.js';
import {ReasoningTrace} from './ReasoningTrace.js';
import {WorkingMemory} from './WorkingMemory.js';
import {loadPersistedWM} from './WorkingMemoryPersistence.js';
import type {EpisodeContext} from './EpisodeTypes.js';

export interface EpisodePreparerDeps {
    eventBus: EventBus;
    insightStream?: InsightStream;
    autonomyConfig: {incorporationLimit: number; incorporationWindowMs: number};
}

export class EpisodePreparer {
    constructor(private readonly deps: EpisodePreparerDeps) {}

    resolveRoute(input: string, ctx: EpisodeContext): Route {
        const base = route(input, {sender: ctx.sender, reasoningDepth: ctx.reasoningDepth});
        if (ctx.routeOverride) return {...base, kind: ctx.routeOverride} as Route;
        return base;
    }

    prepareWM(ctx: EpisodeContext, trace: ReasoningTrace): WorkingMemory {
        if (ctx.workingMemory) {
            trace.recordPrepareWM(ctx.workingMemory.keys().length, ctx.workingMemory.snapshot() as Record<string, unknown>);
            return ctx.workingMemory;
        }
        const wm = new WorkingMemory({eventBus: this.deps.eventBus});
        const persisted = loadPersistedWM(ctx.conversation);
        if (persisted) wm.fromJSON(persisted);
        trace.recordPrepareWM(wm.keys().length, wm.snapshot() as Record<string, unknown>);
        return wm;
    }

    checkAutonomyIntoWM(wm: WorkingMemory, trace: ReasoningTrace): void {
        const insights = this.collectAutonomyInsights();
        if (insights.length === 0) return;
        for (const i of insights) {
            const label = i.truth
                ? `${i.term} (f=${i.truth.frequency.toFixed(2)}, c=${i.truth.confidence.toFixed(2)})`
                : i.term;
            wm.append('prior_insights', label);
        }
        trace.recordAutonomyIncorporate(insights.length);
    }

    private collectAutonomyInsights(): SchedulerInsight[] {
        if (!this.deps.insightStream) return [];
        const {incorporationLimit: limit, incorporationWindowMs: window} = this.deps.autonomyConfig;
        return this.deps.insightStream.pull(limit, window);
    }
}
