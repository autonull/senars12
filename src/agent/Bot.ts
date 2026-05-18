import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import {MessagePipeline} from './pipeline/Pipeline.js';
import {InputNormalizer} from './pipeline/stages/InputNormalizer.js';
import {AuthChecker} from './pipeline/stages/AuthChecker.js';
import {CommandProcessor} from './pipeline/stages/CommandProcessor.js';
import {InputClassifier} from './pipeline/stages/InputClassifier.js';
import {ReasoningTriggerStage} from './pipeline/stages/ReasoningTrigger.js';
import {SeNARSProcessor} from './pipeline/stages/SeNARSProcessor.js';
import {LMResponder} from './pipeline/stages/LMResponder.js';
import {ToolExecutor} from './pipeline/stages/ToolExecutor.js';
import {ResponseComposer} from './pipeline/stages/ResponseComposer.js';
import {ResponseFormatter} from './pipeline/stages/ResponseFormatter.js';
import {StatePersistor} from './pipeline/stages/StatePersistor.js';
import {ConversationStateManager} from './ConversationState.js';
import type {BotContext, BotResponse, BotConfig, Capabilities, ConnectionInfo, IOMessage, InputClassification} from './BotContext.js';
import {detectCapabilities} from './BotContext.js';
import type {BotProfile} from './BotProfile.js';
import type {ChannelType} from './ChannelBehavior.js';
import {CommandRegistry} from '../io/commands/registry.js';
import {coreCommands} from '../io/commands/core.js';
import {memoryCommands} from '../io/commands/memory.js';
import {narCommands} from '../io/commands/nar.js';
import {configCommands} from '../io/commands/config.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';

const DEFAULT_BOT_CONFIG: BotConfig = {
    reasoning: {
        autoTrigger: true,
        triggerThreshold: 0.5,
        triggerCooldown: 3,
        maxStepsPerTrigger: 5,
        backgroundReasoning: true,
        backgroundIntervalMs: 60000,
    },
    streaming: {
        enabled: false,
        showReasoningSteps: false,
        showToolCalls: false,
    },
    conversation: {
        maxHistory: 20,
        summaryThreshold: 30,
        maxArtifacts: 50,
    },
    tui: {
        typingIndicator: true,
        colors: true,
        compactMode: false,
    },
};

export interface BotDeps {
    profile: BotProfile;
    lm?: LMClient;
    nar?: NAR;
    pipeline?: MessagePipeline;
    stateManager?: ConversationStateManager;
    config?: Partial<BotConfig>;
    capabilities?: Capabilities;
    episodicMemory?: EpisodicMemory;
}

export class Bot {
    readonly profile: BotProfile;
    readonly pipeline: MessagePipeline;
    readonly stateManager: ConversationStateManager;
    readonly config: BotConfig;
    readonly capabilities: Capabilities;
    private readonly lm?: LMClient;
    private readonly nar?: NAR;
    private readonly episodicMemory?: EpisodicMemory;
    private readonly commands: CommandRegistry;

    constructor(deps: BotDeps) {
        this.profile = deps.profile;
        this.lm = deps.lm;
        this.nar = deps.nar;
        this.capabilities = deps.capabilities ?? detectCapabilities(this.lm, this.nar);
        this.config = {...DEFAULT_BOT_CONFIG, ...deps.config};
        this.stateManager = deps.stateManager ?? new ConversationStateManager(this.config);
        this.episodicMemory = deps.episodicMemory;
        this.commands = this.createCommandRegistry();

        this.pipeline = deps.pipeline ?? this.createPipeline();
    }

    private createCommandRegistry(): CommandRegistry {
        const registry = new CommandRegistry();
        for (const cmd of [coreCommands, memoryCommands, narCommands, configCommands].flat()) {
            registry.register(cmd);
        }
        return registry;
    }

    private createPipeline(): MessagePipeline {
        return new MessagePipeline([
            new InputNormalizer(),
            new AuthChecker(),
            new CommandProcessor(this.commands),
            new InputClassifier(),
            new ReasoningTriggerStage(),
            new SeNARSProcessor(),
            new LMResponder(),
            new ToolExecutor(),
            new ResponseComposer(),
            new ResponseFormatter(),
            new StatePersistor(this.episodicMemory),
        ]);
    }

    getConnectionInfo(msg: IOMessage, respondFn: (text: string | { content: string; done: boolean }) => Promise<void>): ConnectionInfo {
        return {
            id: msg.source,
            type: (msg.metadata?.connectionType as ChannelType) ?? 'cli',
            sender: msg.sender,
            respond: respondFn,
            stream: async (stream: AsyncIterable<{content: string; done: boolean}>) => {
                let buf = '';
                for await (const chunk of stream) buf += chunk.content;
                await respondFn(buf);
            },
        };
    }

    createContext(connInfo: ConnectionInfo, conversation: ReturnType<ConversationStateManager['getOrCreate']>): BotContext {
        return {
            profile: this.profile,
            lm: this.lm,
            seNARS: this.nar,
            connection: connInfo,
            conversation,
            turn: {
                input: { id: crypto.randomUUID(), source: connInfo.id, sender: connInfo.sender, text: '', timestamp: Date.now() },
                classification: { primary: 'chat', confidence: 0.1, signals: [] },
                reasoningTriggered: false,
                lmSuggestsReasoning: false,
                toolResults: [],
                actions: [],
                finalResponse: '',
            },
            config: this.config,
            capabilities: this.capabilities,
        };
    }

    async processMessage(msg: IOMessage, connInfo: ConnectionInfo, conversation: ReturnType<ConversationStateManager['getOrCreate']>): Promise<BotResponse> {
        const ctx = this.createContext(connInfo, conversation);
        const response = await this.pipeline.process(msg, ctx);

        conversation.addMessage({ role: 'user', content: msg.text, timestamp: Date.now() }, this.lm);
        conversation.addMessage({
            role: 'assistant',
            content: response.text,
            timestamp: Date.now(),
            metadata: ctx.turn.lmSuggestsReasoning ? { suggestsReasoning: true } : undefined,
        }, this.lm);

        if (ctx.turn.reasoningResult) {
            conversation.addArtifact({
                type: 'derivation',
                content: `Derived ${ctx.turn.reasoningResult.steps} belief(s)`,
                timestamp: Date.now(),
            });
        }

        return response;
    }
}