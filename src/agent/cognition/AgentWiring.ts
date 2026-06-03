import type {NAR} from '../../nar/nar.js';
import type {EpisodicMemory} from '../../nar/memory/EpisodicMemory.js';
import type {LMClient} from '../../nar/lm/types.js';
import {EventBus} from '../../nar/types/events.js';
import type {AIAgentConfig, Capabilities} from '../types.js';
import {CognitiveSnapshot} from '../request/CognitiveSnapshot.js';
import {ModelRunner} from '../model/ModelRunner.js';
import {SelfAnalyzerService} from '../services/SelfAnalyzerService.js';
import {MetacognitiveMonitor} from '../services/MetacognitiveMonitor.js';
import {AutonomousScheduler} from '../AutonomousScheduler.js';
import {InsightStream} from '../autonomy/InsightStream.js';
import {ConsolidationEngine} from './ConsolidationEngine.js';
import {EpisodeRunner} from './EpisodeRunner.js';
import {EpisodeRecorder} from './EpisodeRecorder.js';
import {EpisodePreparer} from './EpisodePreparer.js';
import {ToolsBuilder} from './ToolsBuilder.js';
import {AttentionPrimer} from './AttentionPrimer.js';

export interface AgentWiringRefs {
    turnCount: () => number;
    nextTurn: () => number;
    nextCycle: () => number;
    markActivity: () => void;
}

export interface AgentWiring {
    nar?: NAR;
    episodicMemory?: EpisodicMemory;
    lmClient?: LMClient;
    config: AIAgentConfig['config'];
    capabilities: Capabilities;
    eventBus: EventBus;
    snapshot: CognitiveSnapshot;
    runner: ModelRunner;
    selfAnalyzer?: SelfAnalyzerService;
    scheduler?: AutonomousScheduler;
    insightStream?: InsightStream;
    consolidation: ConsolidationEngine;
    toolsBuilder: ToolsBuilder;
    attentionPrimer: AttentionPrimer;
    episodeRunner: EpisodeRunner;
    recorder: EpisodeRecorder;
    preparer: EpisodePreparer;
}

export function buildAgentWiring(config: AIAgentConfig, refs: AgentWiringRefs): AgentWiring {
    const eventBus = new EventBus();
    const snapshot = new CognitiveSnapshot({maxTokens: 1024, ttlMs: 1000});
    const runner = new ModelRunner({
        lmClient: config.lmClient,
        maxLoops: config.config.reasoning.maxStepsPerTrigger,
    });
    let selfAnalyzer: SelfAnalyzerService | undefined;
    let scheduler: AutonomousScheduler | undefined;
    let insightStream: InsightStream | undefined;
    if (config.nar) {
        const monitor = new MetacognitiveMonitor(null);
        selfAnalyzer = new SelfAnalyzerService(config.nar, monitor, null, {recencyEpisodes: config.config.policy.recencyEpisodes});
        scheduler = new AutonomousScheduler(config.nar, {
            reasoningStepsPerWake: 1,
            wakeupIntervalMs: 60_000,
            sleepIntervalMs: 30_000,
            enableLMRules: true,
            effortLevel: 1,
            ringBufferSize: 64,
        });
        insightStream = new InsightStream(scheduler);
    }
    const consolidation = new ConsolidationEngine({
        nar: config.nar,
        lmClient: config.lmClient,
        episodicMemory: config.episodicMemory,
        debounceMs: config.config.policy.consolidationDebounceMs,
    });
    const toolsBuilder = new ToolsBuilder({nar: config.nar, episodicMemory: config.episodicMemory});
    const attentionPrimer = new AttentionPrimer(config.nar);
    const episodeRunner = new EpisodeRunner({
        nar: config.nar,
        episodicMemory: config.episodicMemory,
        lmClient: config.lmClient,
        config: config.config,
        eventBus,
        snapshot,
        runner,
        nextTurn: refs.nextTurn,
        nextCycle: refs.nextCycle,
        markActivity: refs.markActivity,
        primeAttention: (input) => attentionPrimer.prime(input),
        buildTools: (wm) => toolsBuilder.forEpisode(wm),
        absorbModelMessages: (c, m) => { c.absorbModelMessages(m.messages); for (const a of m.artifacts) c.addArtifact(a); },
        pinTopBeliefs: (c, artifacts) => c.pinFromArtifacts(artifacts, config.config.conversation.pinnedBeliefLimit),
        scheduleSummarize: (c) => { if (config.lmClient) c.scheduleSummarize(config.lmClient); },
    });
    const recorder = new EpisodeRecorder({
        selfAnalyzer,
        consolidation,
        config: config.config,
        turnCount: refs.turnCount,
    });
    const preparer = new EpisodePreparer({
        eventBus,
        insightStream,
        autonomyConfig: config.config.autonomy,
    });
    return {
        nar: config.nar,
        episodicMemory: config.episodicMemory,
        lmClient: config.lmClient,
        config: config.config,
        capabilities: config.capabilities,
        eventBus,
        snapshot,
        runner,
        selfAnalyzer,
        scheduler,
        insightStream,
        consolidation,
        toolsBuilder,
        attentionPrimer,
        episodeRunner,
        recorder,
        preparer,
    };
}
