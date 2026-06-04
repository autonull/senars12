import type {NAR} from '../nar/nar.js';
import type {AIAgentConfig, AgentResult, Belief, Capabilities, AgentMetrics, TurnAction, Route} from './types.js';
import type {LMClient} from '../nar/lm/types.js';
import type {ModelEvent} from './model/ModelRunner.js';
import {type AgentPolicy, type SelfAnalyzerService} from './services/SelfAnalyzerService.js';
import {WorkingMemory} from './cognition/WorkingMemory.js';
import {ReasoningTrace} from './cognition/ReasoningTrace.js';
import {reflect, applyVerdict} from './cognition/ReflectionStage.js';
import {ConsolidationEngine} from './cognition/ConsolidationEngine.js';
import {AutonomousScheduler} from './AutonomousScheduler.js';
import {type EpisodeRunner} from './cognition/EpisodeRunner.js';
import {abortedResult, finalizeEpisode, yieldToEventLoop} from './cognition/EpisodeFinalizer.js';
import {persistWM} from './cognition/WorkingMemoryPersistence.js';
import {buildAgentWiring, type AgentWiring} from './cognition/AgentWiring.js';
import type {EpisodeContext, EpisodeResult} from './cognition/EpisodeTypes.js';

export type {EpisodeContext, EpisodeResult, TurnResult} from './cognition/EpisodeTypes.js';

export class AIAgent {
    private readonly wiring: AgentWiring;
    private readonly nar?: NAR;
    private readonly config: AIAgentConfig['config'];
    private readonly capabilities: Capabilities;
    private readonly lmClient?: LMClient;
    private readonly selfAnalyzer?: SelfAnalyzerService;
    private readonly scheduler?: AutonomousScheduler;
    private readonly consolidation: ConsolidationEngine;
    private turnCount = 0;
    private cycleCount = 0;
    private errorCount = 0;
    private isRunning = true;
    private lastActivity = Date.now();
    private aborted = false;
    private episodeController?: AbortController;

    constructor(config: AIAgentConfig) {
        const refs = {
            turnCount: () => this.turnCount,
            nextTurn: () => ++this.turnCount,
            nextCycle: () => ++this.cycleCount,
            markActivity: () => { this.lastActivity = Date.now(); },
        };
        this.wiring = buildAgentWiring(config, refs);
        this.nar = this.wiring.nar;
        this.lmClient = this.wiring.lmClient;
        this.config = this.wiring.config;
        this.capabilities = this.wiring.capabilities;
        this.selfAnalyzer = this.wiring.selfAnalyzer;
        this.scheduler = this.wiring.scheduler;
        this.consolidation = this.wiring.consolidation;
    }

    async executeEpisode(input: string, ctx: EpisodeContext = {}): Promise<EpisodeResult> {
        const start = Date.now();
        const controller = new AbortController();
        this.episodeController = controller;
        const signal = ctx.signal ?? controller.signal;
        const events: ModelEvent[] = [];
        const emit = (e: ModelEvent) => {
            events.push(e);
            ctx.onEvent?.(e);
        };

        try {
            await yieldToEventLoop();
            if (this.aborted || signal.aborted) return abortedResult(input, ctx, start, this.cycleCount, undefined, undefined, this.nar);

            const trace = new ReasoningTrace();
            const routeResult = this.wiring.preparer.resolveRoute(input, ctx);
            trace.recordRoute(routeResult);
            await yieldToEventLoop();
            if (this.aborted || signal.aborted) return abortedResult(input, ctx, start, this.cycleCount, routeResult, trace, this.nar);

            const wm = this.wiring.preparer.prepareWM(ctx, trace);
            await yieldToEventLoop();
            this.wiring.preparer.checkAutonomyIntoWM(wm, trace);
            await yieldToEventLoop();

            const candidate = await this.runCandidate(input, routeResult, ctx, start, wm, trace, emit, signal);
            await yieldToEventLoop();

            const verdict = ctx.skipReflection || this.isDirectRoute(routeResult.kind)
                ? {action: 'accept' as const}
                : await reflect(candidate.text, trace, {lmClient: this.lmClient, nar: this.nar, workingMemory: wm, maxOutputTokens: 256}, signal);
            trace.recordReflect(verdict);
            const reflectionArtifacts: EpisodeResult['artifacts'] = [];
            applyVerdict(verdict, {workingMemory: wm, nar: this.nar}, reflectionArtifacts);
            await yieldToEventLoop();

            const finalArtifacts = [...candidate.artifacts, ...reflectionArtifacts];
            const result = finalizeEpisode(candidate, verdict, finalArtifacts, wm, trace, ctx, start, events.length, this.cycleCount);
            persistWM(ctx.conversation, wm);
            this.wiring.recorder.record(input, result, routeResult, wm, signal);
            this.wiring.recorder.updatePolicy(routeResult, result);
            return result;
        } finally {
            this.episodeController = undefined;
        }
    }

    async chat(input: string, ctx: EpisodeContext = {}): Promise<string> {
        return (await this.executeEpisode(input, ctx)).text;
    }

    async process(input: string, ctx: EpisodeContext = {}): Promise<AgentResult> {
        const start = Date.now();
        try {
            const result = await this.executeEpisode(input, ctx);
            const actions: TurnAction[] = result.toolCalls.map(tc => ({type: 'tool_call' as const, content: tc.toolName}));
            this.wiring.eventBus.emit('agent:process:complete', {result, durationMs: Date.now() - start});
            return {success: true, response: result.text, actions, metrics: result.metrics};
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.errorCount++;
            return {success: false, response: '', error: err.message, metrics: {durationMs: Date.now() - start, cycleCount: this.cycleCount, eventCount: 0}};
        }
    }

    async reason(input: string, steps?: number): Promise<Belief[]> {
        const result = await this.executeEpisode(input, {reasoningDepth: steps});
        return result.artifacts
            .map(a => a.metadata?.belief)
            .filter((b): b is string => typeof b === 'string')
            .map(term => ({term}));
    }

    async replay(episodeId: string): Promise<{original: {input: string; response: string; artifacts: number; routeKind?: string}; replay: EpisodeResult; match: {text: boolean; toolCalls: boolean; artifacts: number}}> {
        const original = this.consolidation.getEpisodeById(episodeId);
        if (!original) throw new Error(`Episode not found: ${episodeId}`);

        const routeOverride = original.routeKind as Route['kind'] | undefined;
        const replay = await this.executeEpisode(original.input, {
            routeOverride,
            skipReflection: true,
            sender: 'replay',
        });

        return {
            original: {
                input: original.input,
                response: original.response,
                artifacts: original.artifacts.length,
                routeKind: original.routeKind,
            },
            replay,
            match: {
                text: replay.text === original.response,
                toolCalls: replay.toolCalls.length === 0 && original.artifacts.length === 0,
                artifacts: replay.artifacts.length,
            },
        };
    }

    listEpisodes(limit = 20): Array<{id: string; input: string; routeKind?: string}> {
        return this.consolidation.getRecentEpisodes(limit).map(r => ({
            id: r.id, input: r.input, routeKind: r.routeKind,
        }));
    }

    async suspend(): Promise<void> {
        this.isRunning = false;
        this.wiring.eventBus.emit('agent:suspend', {cycleCount: this.cycleCount, lastActivity: this.lastActivity});
    }

    async resume(): Promise<void> {
        this.isRunning = true;
        this.aborted = false;
        this.wiring.eventBus.emit('agent:resume', {cycleCount: this.cycleCount, lastActivity: this.lastActivity});
    }

    abort(): void {
        this.aborted = true;
        this.episodeController?.abort();
        this.wiring.eventBus.emit('agent:abort', {cycleCount: this.cycleCount});
    }

    getMetrics(): AgentMetrics {
        return {
            cycleCount: this.cycleCount,
            isRunning: this.isRunning,
            errorCount: this.errorCount,
            lastActivity: this.lastActivity,
            narMetrics: this.nar?.getStatistics(),
            conversationMetrics: undefined,
        };
    }

    getState(): 'idle' | 'normal' | 'confused' {
        return this.errorCount > 10 ? 'confused' : (this.isRunning ? 'normal' : 'idle');
    }

    getCapabilities(): Capabilities { return this.capabilities; }
    getTurnCount(): number { return this.turnCount; }
    getConsolidationEngine(): ConsolidationEngine { return this.consolidation; }
    getScheduler(): AutonomousScheduler | undefined { return this.scheduler; }

    getPolicy(): AgentPolicy {
        return this.selfAnalyzer?.getPolicy() ?? {
            routingWeights: {'narsese-belief': 1, 'narsese-question': 1, command: 1, nl: 1},
            toolSelectionBias: {},
            promptBudget: this.config.policy.promptBudget,
            recencyEpisodes: this.config.policy.recencyEpisodes,
            updatedAt: 0,
        };
    }

    private isDirectRoute(kind: Route['kind']): boolean {
        return kind === 'narsese-belief' || kind === 'narsese-question' || kind === 'command';
    }

    private async runCandidate(
        input: string,
        routeResult: Route,
        ctx: EpisodeContext,
        start: number,
        wm: WorkingMemory,
        trace: ReasoningTrace,
        emit: (e: ModelEvent) => void,
        signal: AbortSignal,
    ): ReturnType<EpisodeRunner['runModelCandidate']> {
        if (this.isDirectRoute(routeResult.kind)) {
            return this.wiring.episodeRunner.runNoModelCandidate(input, routeResult, ctx, start);
        }
        return this.wiring.episodeRunner.runModelCandidate(input, routeResult, ctx, start, wm, trace, emit, signal);
    }
}
