import type { NAR } from '../../../nar/src';

import { type Logger, createLogger } from '../../../nar/src/logger';
import type { EpisodeType, EpisodicMemory } from '../../../nar/src/memory/EpisodicMemory.js';
import {
  ContextAssembler,
  type ContextAssemblerOpts,
  NLGenerationService,
  NLUnderstandingService,
  TranslationCache,
} from '../../../nar/src/nl';
import { errMsg } from '../../../nar/src/utils';
import type { AutonomousLoop } from '../AutonomousLoop.js';
import type { AutonomyEngine } from '../AutonomyEngine.js';
import type { ConversationSession } from '../ConversationSession.js';
import { EventBus, type EventKey, type EventMap } from '../EventBus.js';
import { type InputEvent, type InputProcessorDeps, processInput } from '../input-processor.js';
import { ModelRunner } from '../model/ModelRunner.js';
import { LifecycleManager } from '../services/LifecycleManager.js';
import { ToolBuilder } from '../services/ToolBuilder.js';
import { ApprovalService } from '../services/ApprovalService.js';
import { KnowledgeManager } from '../subservices/KnowledgeManager.js';
import { PromptBuilder } from '../subservices/PromptBuilder.js';
import { SessionOrchestrator } from '../subservices/SessionOrchestrator.js';
import { StatsManager } from '../subservices/StatsManager.js';

import { LMChatService } from '../services/LMChatService.js';
import { NarQueryService } from '../services/NarQueryService.js';
import { SelfReasoningService } from '../services/SelfReasoningService.js';
import type {
  Agent,
  AgentOptions,
  AgentStats,
  ChatOptions,
  ChatStreamEvent,
  DerivationEntry,
  PendingApproval,
} from '../types.js';

const MAX_RECENT_DERIVATIONS = 50;

export class AgentImpl implements Agent {
  private readonly nar?: NAR;
  private readonly episodicMemory?: EpisodicMemory;
  private readonly logger: Logger;

  private readonly runner: ModelRunner;
  private knowledgeManager: KnowledgeManager;
  private readonly sessionOrchestrator: SessionOrchestrator;
  private readonly eventBus: EventBus;
  private approvalService: ApprovalService;
  private readonly translationCache: TranslationCache;
  private readonly contextAssembler?: ContextAssembler;
  private readonly understandingService?: NLUnderstandingService;
  private readonly generationService?: NLGenerationService;
  private readonly statsManager: StatsManager;
  private readonly promptBuilder: PromptBuilder;
  private narQueryService: NarQueryService;
  private lmChatService: LMChatService;
  private selfReasoningService: SelfReasoningService;

  private readonly autonomyEngine?: AutonomyEngine;
  private readonly autonomousLoop?: AutonomousLoop;
  private recentDerivations: DerivationEntry[] = [];
  private readonly extToolOpts: Record<string, unknown> = {};
  private readonly contextOpts: ContextAssemblerOpts;
  private readonly processInputDeps: InputProcessorDeps;
  private readonly lifecycleManager: LifecycleManager;
  private readonly toolBuilder: ToolBuilder;

  constructor(opts: AgentOptions) {
    this.nar = opts.nar;
    this.episodicMemory = opts.episodicMemory;
    this.logger = opts.logger ?? createLogger({ scope: 'agent' });
    this.extToolOpts = (opts.externalTools as Record<string, unknown>) ?? {};
    this.contextOpts = opts.context ?? {};

    this.runner = new ModelRunner({ lmService: opts.lmService, maxLoops: opts.maxLoops ?? 5 });
    this.knowledgeManager = new KnowledgeManager({
      knowledgePath: opts.knowledgePath ?? '.cache/agent-knowledge.json',
      persistKnowledge: opts.persistKnowledge ?? false,
    });

    this.sessionOrchestrator = new SessionOrchestrator();
    this.eventBus = new EventBus();
    this.approvalService = new ApprovalService({ approvalManager: opts.approvalManager });
    this.translationCache = new TranslationCache({
      basePath: process.env.TRANSLATION_CACHE_PATH ?? '.cache/translation-cache',
    });

    const narRegistry = this.nar?.getProviderRegistry?.();
    if (this.nar) {
      this.contextAssembler = new ContextAssembler(this.translationCache);
    }
    if (this.nar && narRegistry) {
      this.understandingService = new NLUnderstandingService(narRegistry, this.translationCache, {
        structuredOnly: true,
      });
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

    this.selfReasoningService = new SelfReasoningService({
      nar: this.nar,
      logger: this.logger,
    });

    this.lifecycleManager = new LifecycleManager({
      nar: this.nar,
      episodicMemory: this.episodicMemory,
      autonomyEngine: this.autonomyEngine,
      autonomousLoop: this.autonomousLoop,
      logger: this.logger,
      onDerivationCapture: (count) => this.captureDerivations(count),
    });

    this.toolBuilder = new ToolBuilder({
      nar: this.nar,
      episodicMemory: this.episodicMemory,
      sessionOrchestrator: this.sessionOrchestrator,
      extToolOpts: this.extToolOpts,
      know: (k: string, v: string) => this.know(k, v),
      knowGet: (k: string) => this.knowGet(k),
      knowList: () => this.knowList(),
      recall: (q?: string, l?: number) => this.recall(q, l),
    });
  }

  chat(
    input: string,
    opts: ChatOptions & { stream: true }
  ): AsyncGenerator<ChatStreamEvent, string>;

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

  async chatWithHistory(
    input: string,
    session: ConversationSession,
    opts: ChatOptions = {}
  ): Promise<string> {
    return this.lmChatService.chatWithHistory(input, session, opts);
  }

  async *chatStream(
    input: string,
    session?: ConversationSession,
    opts: ChatOptions = {}
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
    await this.safeLog('belief_added', narsese);
  }

  async recall(
    query?: string,
    limit = 10
  ): Promise<Array<{ timestamp: number; type: string; content: string }>> {
    if (!this.episodicMemory) return [];
    const episodes = await this.episodicMemory.getEpisodes({ limit }).catch(() => []);
    const q = query?.toLowerCase();
    return (q ? episodes.filter((e) => e.content.toLowerCase().includes(q)) : episodes).map(
      (e) => ({ timestamp: e.timestamp, type: e.type, content: e.content })
    );
  }

  know(key: string, value: string): void {
    this.knowledgeManager.know(key, value);
    this.safeLog('input', value, { kind: 'knowledge', key });
  }

  knowGet(key: string): string | undefined {
    return this.knowledgeManager.knowGet(key);
  }

  knowList(): Array<{ key: string; value: string }> {
    return this.knowledgeManager.knowList();
  }

  start(): () => void {
    const stop = this.lifecycleManager.start();
    this.eventBus.emit('agent:resume', { timestamp: Date.now() });
    return () => {
      stop();
      this.stop();
    };
  }

  stop(): void {
    this.lifecycleManager.stop();
    this.knowledgeManager.saveKnowledge();
    this.eventBus.emit('agent:suspend', { timestamp: Date.now() });
  }

  pause(): void {
    this.lifecycleManager.pause();
  }

  resume(): void {
    this.lifecycleManager.resume();
  }

  setThrottle(percent: number): void {
    this.lifecycleManager.setThrottle(percent);
  }

  getThrottle(): number {
    return this.lifecycleManager.getThrottle();
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
    return this.approvalService.resolveApproval(id, approved, reason);
  }

  getPendingApprovals(): PendingApproval[] {
    return this.approvalService.getPendingApprovals();
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
    totalSteps: number;
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
        policyOptimizer
          ?.getAllStrategies?.()
          .map((s: string) => [s, policyOptimizer.getStrategyStats?.(s)?.priority ?? 1]) ?? []
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
    const rlfp = this.nar?.getRLFP?.() as unknown as {
      reward?: (reward: number, context?: string) => void;
    };
    if (rlfp?.reward) {
      rlfp.reward(reward, context);
    }
  }

  getSelfReasoning(): {
    qualityScore: number;
    consistency: number;
    gaps: string[];
    suggestions: string[];
  } | null {
    return this.selfReasoningService.getSelfReasoning();
  }

  getReasoningQuality(): {
    overall: number;
    coherence: number;
    relevance: number;
    completeness: number;
  } | null {
    return this.selfReasoningService.getReasoningQuality();
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
    const systemEventBus = this.nar?.getSystemEventBus?.();
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

  private safeLog(
    type: EpisodeType,
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.episodicMemory) return Promise.resolve();
    return this.episodicMemory.log(type, content, metadata).catch((err) => {
      this.logger.warn('episodic memory log failed', { type, error: errMsg(err) });
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
          truth: b.truth ? { f: b.truth.f, c: b.truth.c } : undefined,
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
    return this.toolBuilder.buildTools(session);
  }
}
