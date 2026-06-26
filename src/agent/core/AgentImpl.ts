import type {NAR} from '../../nar/nar.js';

import type {EpisodeType, EpisodicMemory} from '../../nar/memory/EpisodicMemory.js';
import {ContextAssembler, type ContextAssemblerOpts} from '../../nar/nl/context-assembler.js';
import {NLUnderstandingService} from '../../nar/nl/understanding.js';
import {NLGenerationService} from '../../nar/nl/generation.js';
import {TranslationCache} from '../../nar/nl/cache.js';
import {ApprovalManager, createGeneralTools, createNARSTools,} from '../../nar/tools/adapters/index.js';
import {ModelRunner} from '../model/ModelRunner.js';
import {buildAgentTools} from '../tools.js';
import type {ConversationSession} from '../ConversationSession.js';

import {createLogger, type Logger} from '../../nar/logger/index.js';
import {EventBus, type EventKey, type EventMap} from '../EventBus.js';
import {AutonomyEngine} from '../AutonomyEngine.js';
import type {AutonomousLoop} from '../AutonomousLoop.js';
import {type InputEvent, type InputProcessorDeps, processInput} from '../input-processor.js';
import {StatsManager} from '../subservices/StatsManager.js';
import {KnowledgeManager} from '../subservices/KnowledgeManager.js';
import {SessionOrchestrator} from '../subservices/SessionOrchestrator.js';
import {PromptBuilder} from '../subservices/PromptBuilder.js';

import type {Agent, AgentOptions, AgentStats, ChatOptions, ChatStreamEvent, DerivationEntry} from '../types.js';
import {NarQueryService} from '../services/NarQueryService.js';
import {LMChatService} from '../services/LMChatService.js';

const REASONING_INTERVAL_MS = 60_000;
const MAX_REASON_STEPS_PER_TICK = 5;
const MIN_REASON_STEPS_PER_TICK = 1;
const MAX_RECENT_DERIVATIONS = 50;

export class AgentImpl implements Agent {
    private nar?: NAR;
    private episodicMemory?: EpisodicMemory;
    private logger: Logger;

    private runner: ModelRunner;
    private knowledgeManager: KnowledgeManager;
    private sessionOrchestrator: SessionOrchestrator;
    private eventBus: EventBus;
    private approvalManager: ApprovalManager;
    private translationCache: TranslationCache;
    private contextAssembler?: ContextAssembler;
    private understandingService?: NLUnderstandingService;
    private generationService?: NLGenerationService;
    private statsManager: StatsManager;
    private promptBuilder: PromptBuilder;
    private narQueryService: NarQueryService;
    private lmChatService: LMChatService;

    private throttle = 100;
    private reasoningHandle?: ReturnType<typeof setInterval>;
    private autonomyEngine?: AutonomyEngine;
    private autonomousLoop?: AutonomousLoop;
    private recentDerivations: DerivationEntry[] = [];
    private extToolOpts: Record<string, unknown> = {};
    private contextOpts: ContextAssemblerOpts;
    private processInputDeps: InputProcessorDeps;

    constructor(opts: AgentOptions) {
        this.nar = opts.nar;
        this.episodicMemory = opts.episodicMemory;
        this.logger = opts.logger ?? createLogger({scope: 'agent'});
        this.extToolOpts = (opts.externalTools as Record<string, unknown>) ?? {};
        this.contextOpts = opts.context ?? {};

        this.runner = new ModelRunner({lmClient: opts.lmClient, maxLoops: opts.maxLoops ?? 5});
        this.knowledgeManager = new KnowledgeManager({
            knowledgePath: opts.knowledgePath ?? '.cache/agent-knowledge.json',
            persistKnowledge: opts.persistKnowledge ?? false,
        });

        this.sessionOrchestrator = new SessionOrchestrator();
        this.eventBus = new EventBus();
        this.approvalManager = opts.approvalManager ?? new ApprovalManager();
        this.translationCache = new TranslationCache({basePath: process.env.TRANSLATION_CACHE_PATH ?? '.cache/translation-cache'});

        const narRegistry = this.nar?.getProviderRegistry?.();
        if (this.nar) {
            this.contextAssembler = new ContextAssembler(this.translationCache);
        }
        if (this.nar && narRegistry) {
            this.understandingService = new NLUnderstandingService(narRegistry, this.translationCache, {structuredOnly: true});
            this.generationService = new NLGenerationService(narRegistry);
        }

        this.statsManager = new StatsManager();
        this.promptBuilder = new PromptBuilder(
            opts.systemInstructions ?? '',
            this.sessionOrchestrator,
            this.recentDerivations,
            this.nar,
            this.contextAssembler,
            this.contextOpts
        );

        this.narQueryService = new NarQueryService(this.nar, this.generationService);
        this.autonomyEngine = opts.autonomyEngine;
        this.autonomousLoop = opts.autonomousLoop;

        this.processInputDeps = {
            nar: this.nar,
            hasLmModel: this.runner.hasModel(),
            understandingService: this.understandingService,
            generationService: this.generationService,
            contextAssembler: this.contextAssembler!,
            contextOpts: this.contextOpts,
            autonomyEngine: this.autonomyEngine,
        };

        this.lmChatService = new LMChatService(
            this.runner,
            this.promptBuilder,
            this.eventBus,
            this.statsManager,
            this.buildTools.bind(this),
            this.safeLog.bind(this),
            this.processInputDeps
        );
    }

    chat(input: string, opts: ChatOptions & { stream: true }): AsyncGenerator<ChatStreamEvent, string>;

    chat(input: string, opts?: ChatOptions & { stream?: false }): Promise<string>;

    chat(input: string, opts: ChatOptions = {}): any {
        if (opts.stream) {
            return this.lmChatService.chatStream(input, opts.session, opts);
        }
        if (opts.session) {
            return this.lmChatService.chatWithHistory(input, opts.session, opts);
        }
        return this.lmChatService.chat(input, opts);
    }

    async chatWithHistory(input: string, session: ConversationSession, opts: ChatOptions = {}): Promise<string> {
        return this.lmChatService.chatWithHistory(input, session, opts);
    }

    async* chatStream(
        input: string,
        session?: ConversationSession,
        opts: ChatOptions = {},
    ): AsyncGenerator<ChatStreamEvent, string> {
        let final = '';
        for await (const event of this.lmChatService.chatStream(input, session, opts)) {
            if (event.kind === 'finish' || event.kind === 'aborted' || event.kind === 'error') {
                final = event.text ?? '';
            }
            yield event;
        }
        return final;
    }

    async believe(narsese: string): Promise<void> {
        const gen = processInput(this.processInputDeps, narsese, {});
        let next = await gen.next();
        let event: InputEvent | undefined;
        while (!next.done) {
            event = next.value;
            next = await gen.next();
        }

        if (event?.kind === 'narsese-input' || event?.kind === 'question-response') {
            // already processed by processInput
        } else {
            await this.nar?.believe(narsese);
        }
        this.safeLog('belief_added', narsese);
    }

    async recall(query?: string, limit = 10): Promise<Array<{ timestamp: number; type: string; content: string }>> {
        if (!this.episodicMemory) return [];
        const episodes = await this.episodicMemory.getEpisodes({limit}).catch(() => []);
        const q = query?.toLowerCase();
        return (q ? episodes.filter(e => e.content.toLowerCase().includes(q)) : episodes)
            .map(e => ({timestamp: e.timestamp, type: e.type, content: e.content}));
    }

    know(key: string, value: string): void {
        this.knowledgeManager.know(key, value);
        this.safeLog('input', value, {kind: 'knowledge', key});
    }

    knowGet(key: string): string | undefined {
        return this.knowledgeManager.knowGet(key);
    }

    knowList(): Array<{ key: string; value: string }> {
        return this.knowledgeManager.knowList();
    }

    start(): () => void {
        if (!this.nar) return () => {
        };
        if (this.nar.state === 'created') {
            this.nar.initialize().then(() => this.nar!.start()).catch(err => {
                this.logger.warn('NAR lifecycle failed', {error: err instanceof Error ? err.message : String(err)});
            });
        } else if (this.nar.state === 'initialized') {
            this.nar.start().catch(err => {
                this.logger.warn('NAR start failed', {error: err instanceof Error ? err.message : String(err)});
            });
        }

        if (this.autonomousLoop) {
            this.autonomousLoop.start().catch(err => {
                this.logger.warn('AutonomousLoop start failed', {error: err instanceof Error ? err.message : String(err)});
            });
        }
        if (this.autonomyEngine) {
            this.autonomyEngine.setNotifyHandler((msg) => this.logger.debug(msg));
            this.autonomyEngine.start();
        } else if (!this.reasoningHandle && !this.autonomousLoop) {
            this.reasoningHandle = setInterval(async () => {
                if (this.throttle === 0 || !this.nar) return;
                const driveManager = this.nar.getDriveManager();
                const urgency = driveManager?.getUrgency() ?? 0;
                const urgencySteps = Math.round(MIN_REASON_STEPS_PER_TICK + (MAX_REASON_STEPS_PER_TICK - MIN_REASON_STEPS_PER_TICK) * urgency);
                const steps = Math.max(MIN_REASON_STEPS_PER_TICK, Math.round(urgencySteps * (this.throttle / 100)));
                try {
                    const derived = await this.nar.run(steps);
                    if (derived > 0) await this.captureDerivations(derived);
                } catch {
                    // background reasoning is best-effort
                }
            }, REASONING_INTERVAL_MS);
            this.reasoningHandle.unref();
        }
        this.eventBus.emit('agent:resume', {timestamp: Date.now()});
        return () => this.stop();
    }

    stop(): void {
        if (this.autonomousLoop) {
            this.autonomousLoop.stop();
        }
        if (this.autonomyEngine) {
            this.autonomyEngine.stop();
        } else if (this.reasoningHandle) {
            clearInterval(this.reasoningHandle);
            this.reasoningHandle = undefined;
        }
        if (this.nar && (this.nar.state === 'started' || this.nar.state === 'initialized')) {
            this.nar.stop().catch(err => {
                this.logger.warn('NAR stop failed', {error: err.message});
            });
        }
        this.knowledgeManager.saveKnowledge();
        this.eventBus.emit('agent:suspend', {timestamp: Date.now()});
    }

    pause(): void {
        this.autonomyEngine?.pause();
    }

    resume(): void {
        this.autonomyEngine?.resume();
    }

    setThrottle(percent: number): void {
        this.throttle = Math.max(0, Math.min(100, percent));
    }

    getThrottle(): number {
        return this.throttle;
    }

    getNAR(): NAR | undefined {
        return this.nar;
    }

    getEpisodicMemory(): EpisodicMemory | undefined {
        return this.episodicMemory;
    }

    getLogger(): Logger {
        return this.logger;
    }

    getStats(): AgentStats {
        return this.statsManager.getStats();
    }

    getRecentDerivations(): DerivationEntry[] {
        return [...this.recentDerivations];
    }

    resolveApproval(id: string, approved: boolean, reason?: string): boolean {
        return this.approvalManager.resolveApproval(id, approved, reason);
    }

    getPendingApprovals(): Array<{ id: string; request: string; createdAt: number }> {
        return this.approvalManager.getPending().map(r => ({id: r.id, request: r.request, createdAt: r.createdAt}));
    }

    getLmRuleStats() {
        return this.nar?.getProcessor().getLmRuleStats?.() ?? [];
    }

    getLmRuleExecutionLog() {
        return this.nar?.getProcessor().getLMRuleExecutionLog?.() ?? [];
    }

    enableLmRule(id: string): void {
        this.nar?.getProcessor().getLMRule?.(id)?.enable?.();
    }

    disableLmRule(id: string): void {
        this.nar?.getProcessor().getLMRule?.(id)?.disable?.();
    }

    setLmRulePriority(id: string, priority: number): void {
        const rule = this.nar?.getProcessor().getLMRule?.(id);
        if (rule && 'priority' in rule) (rule as { priority: number }).priority = priority;
    }

    getAutonomyEngine(): AutonomyEngine | undefined {
        return this.autonomyEngine;
    }

    getAutonomousLoop(): AutonomousLoop | undefined {
        return this.autonomousLoop;
    }

    getRLFPState(): {
        enabled: boolean;
        policy: Record<string, number>;
        qValues: Record<string, number>;
        explorationRate: number;
        totalRewards: number;
        totalSteps: number
    } | null {
        const rlfp = this.nar?.getRLFP?.() as unknown as {
            policyOptimizerPublic?: {
                getAllStrategies?: () => string[];
                getStrategyStats?: (s: string) => { priority: number };
                config?: { explorationRate?: number };
            };
            trajectoryCount?: number;
        };
        if (!rlfp) return null;
        const policyOptimizer = rlfp.policyOptimizerPublic;
        return {
            enabled: true,
            policy: Object.fromEntries(
                policyOptimizer?.getAllStrategies?.().map((s: string) => [s, policyOptimizer.getStrategyStats?.(s)?.priority ?? 1]) ?? []
            ),
            qValues: {},
            explorationRate: policyOptimizer?.config?.explorationRate ?? 0.1,
            totalRewards: rlfp.trajectoryCount ?? 0,
            totalSteps: rlfp.trajectoryCount ?? 0,
        };
    }

    resetRLFP(): void {
        const rlfp = this.nar?.getRLFP?.() as unknown as { reset?: () => void };
        if (rlfp?.reset) {
            rlfp.reset();
        }
    }

    provideRLFPFeedback(reward: number, context?: string): void {
        const rlfp = this.nar?.getRLFP?.() as unknown as { reward?: (reward: number, context?: string) => void };
        if (rlfp?.reward) {
            rlfp.reward(reward, context);
        }
    }

    getSelfReasoning(): { qualityScore: number; consistency: number; gaps: string[]; suggestions: string[] } | null {
        return this.nar?.getSelfAnalyzer?.() ? {
            qualityScore: 0,
            consistency: 0,
            gaps: [],
            suggestions: [],
        } : null;
    }

    getReasoningQuality(): { overall: number; coherence: number; relevance: number; completeness: number } | null {
        return this.nar?.getSelfAnalyzer?.() ? {
            overall: 0,
            coherence: 0,
            relevance: 0,
            completeness: 0,
        } : null;
    }

    explainBelief(term: string) {
        return this.narQueryService.explainBelief(term);
    }

    explainGoal(term: string) {
        return this.narQueryService.explainGoal(term);
    }

    traceRule(ruleId: string, term: string) {
        return this.narQueryService.traceRule(ruleId, term);
    }

    getGoalProgress(goalId: string) {
        return this.narQueryService.getGoalProgress(goalId);
    }

    listActiveGoals() {
        return this.narQueryService.listActiveGoals();
    }

    explainInNaturalLanguage(term: string) {
        return this.narQueryService.explainInNaturalLanguage(term);
    }

    on<K extends EventKey>(event: K, listener: (payload: EventMap[K]) => void): () => void;

    on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): () => void;

    on(event: string, listener: (...args: any[]) => void): () => void {
        const unsubAgent = this.eventBus.on(event as any, listener);
        const systemEventBus = this.nar?.getEventBus?.();
        const unsubSystem = systemEventBus?.on(event as any, listener);
        return () => {
            unsubAgent();
            unsubSystem?.();
        };
    }

    off<K extends EventKey>(event: K, listener: (payload: EventMap[K]) => void): void;

    off<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): void;

    off(event: string, listener: (...args: any[]) => void): void {
        this.eventBus.off(event as any, listener);
        this.nar?.getEventBus?.()?.off(event as any, listener);
    }

    private safeLog(type: EpisodeType, content: string, metadata: Record<string, unknown> = {}): Promise<void> {
        if (!this.episodicMemory) return Promise.resolve();
        return this.episodicMemory.log(type, content, metadata).catch(err => {
            this.logger.warn('episodic memory log failed', {
                type,
                error: err instanceof Error ? err.message : String(err),
            });
        });
    }

    private async captureDerivations(count: number): Promise<void> {
        if (!this.nar || count <= 0) return;
        try {
            const beliefs = this.nar.getBeliefs();
            const recent = beliefs.slice(-count);
            for (const b of recent) {
                const entry: DerivationEntry = {
                    term: b.term.toString(),
                    truth: b.truth ? {f: b.truth.f, c: b.truth.c} : undefined,
                    timestamp: Date.now(),
                };
                this.recentDerivations.push(entry);
            }
            if (this.recentDerivations.length > MAX_RECENT_DERIVATIONS) {
                this.recentDerivations.splice(0, this.recentDerivations.length - MAX_RECENT_DERIVATIONS);
            }
        } catch {
            // derivation capture is best-effort
        }
    }

    private buildTools(session?: ConversationSession): Record<string, unknown> {
        const tools: Record<string, unknown> = {};
        if (this.nar) {
            Object.assign(tools, createNARSTools(this.nar as Parameters<typeof createNARSTools>[0]));
            Object.assign(tools, createGeneralTools({
                nar: this.nar as Parameters<typeof createGeneralTools>[0]['nar'],
                episodicMemory: this.episodicMemory as Parameters<typeof createGeneralTools>[0]['episodicMemory'],
            }));
        }
        Object.assign(tools, buildAgentTools({
            know: (k: string, v: string) => this.know(k, v),
            knowGet: (k: string) => this.knowGet(k),
            knowList: () => this.knowList(),
            recall: (q?: string, l?: number) => this.recall(q, l),
            setInstructions: session ? (mode, instructions) => {
                this.sessionOrchestrator.setSessionInstructions(session, mode, instructions);
            } : undefined,
            getSessionInfo: session ? () => ({
                messageCount: session.history.length,
                createdAt: session.createdAt,
                pinnedBeliefs: [...session.pinnedBeliefs],
            }) : undefined,
        }));

        if (session) {
            const pad = this.sessionOrchestrator.getScratchpad(session);
            if (pad) {
                Object.assign(tools, {
                    set_context: {
                        description: 'Store a key-value pair in the session scratchpad for this conversation.',
                        inputSchema: {
                            type: 'object',
                            properties: {key: {type: 'string'}, value: {type: 'string'}},
                            required: ['key', 'value']
                        },
                        execute: ({key, value}: { key: string; value: string }) => {
                            pad.set(key, value);
                            return {stored: true, key};
                        },
                    },
                    get_context: {
                        description: 'Retrieve a value from the session scratchpad.',
                        inputSchema: {type: 'object', properties: {key: {type: 'string'}}, required: ['key']},
                        execute: ({key}: { key: string }) => {
                            const value = pad.get(key);
                            return value !== undefined ? {found: true, key, value} : {found: false, key};
                        },
                    },
                    list_context: {
                        description: 'List all entries in the session scratchpad.',
                        inputSchema: {type: 'object', properties: {}},
                        execute: () => ({entries: [...pad.entries()].map(([k, v]) => ({key: k, value: v}))}),
                    },
                });
            }
        }

        if (this.extToolOpts) {
            Object.assign(tools, this.extToolOpts);
        }

        return tools;
    }
}
