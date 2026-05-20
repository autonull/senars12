import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import {MessagePipeline, PRESETS, type StageFactory} from './pipeline/index.js';
import {ConversationStateManager} from './ConversationStateManager.js';
import type {BotContext, BotResponse, BotConfig, Capabilities, ConnectionInfo, IOMessage, PipelineEvents, StreamChunk} from './BotContext.js';
import {detectCapabilities, PipelineEventEmitter} from './BotContext.js';
import type {BotProfile} from './BotProfile.js';
import type {ChannelType} from './ChannelBehavior.js';
import {CommandRegistry} from '../io/commands/registry.js';
import {coreCommands} from '../io/commands/core.js';
import {memoryCommands} from '../io/commands/memory.js';
import {narCommands} from '../io/commands/nar.js';
import {configCommands} from '../io/commands/config.js';
import {episodesCommands} from '../io/commands/episodes.js';
import {scenarioCommands} from '../io/commands/scenario.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import type {ConnectionManager} from '../io/connection-manager.js';
import type {ConnectionConfig} from '../io/types.js';
import type {AgenticLoopConfig} from './AgenticLoop.js';
import {createLogger} from '../nar/logger/index.js';

type EventCallback<T> = (data: T) => void;

const DEFAULT_BOT_CONFIG: BotConfig = {
  reasoning: {
    autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3,
    maxStepsPerTrigger: 5, backgroundReasoning: true, backgroundIntervalMs: 60000, lmDriven: true,
  },
  streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
  conversation: {maxHistory: 20, summaryThreshold: 30, maxArtifacts: 50},
  pipeline: {maxLoops: 2, stageTimeoutMs: 30000, enableLoopBack: true, loopBackOn: ['believe', 'question']},
  directives: {builtIn: true},
  nlParsers: {builtIn: true},
  classifier: {},
  lmRules: {enabled: true, rules: []},
  prompts: {},
  tui: {typingIndicator: true, colors: true, compactMode: false, statusBar: true},
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
    readonly events: PipelineEventEmitter;
    readonly commands: CommandRegistry;
    readonly episodicMemory?: EpisodicMemory;

    private readonly lm?: LMClient;
    private readonly nar?: NAR;
    private connectionManager?: ConnectionManager;
    private agenticLoop?: {setMessageHandler: (h: (msg: IOMessage) => Promise<void>) => void; start: () => void; stop: () => void};
    private logger = createLogger({scope: 'bot'});

    constructor(deps: BotDeps) {
        this.profile = deps.profile;
        this.lm = deps.lm;
        this.nar = deps.nar;
        this.episodicMemory = deps.episodicMemory;
        this.capabilities = deps.capabilities ?? detectCapabilities(this.lm, this.nar);
        this.config = this.mergeConfig(deps.config ?? {});
        this.events = new PipelineEventEmitter();
        this.stateManager = deps.stateManager ?? new ConversationStateManager(this.config);
        this.commands = this.createCommandRegistry();
        this.pipeline = deps.pipeline ?? this.createPipeline();
    }

    private mergeConfig(o: Partial<BotConfig>): BotConfig {
        const d = DEFAULT_BOT_CONFIG;
        return {
            reasoning: {...d.reasoning, ...o.reasoning},
            streaming: {...d.streaming, ...o.streaming},
            conversation: {...d.conversation, ...o.conversation},
            pipeline: {...d.pipeline, ...o.pipeline, loopBackOn: o.pipeline?.loopBackOn ?? d.pipeline.loopBackOn},
            directives: {...d.directives, ...o.directives},
            nlParsers: {...d.nlParsers, ...o.nlParsers},
            classifier: {...d.classifier, ...o.classifier},
            lmRules: {...d.lmRules, ...o.lmRules, rules: o.lmRules?.rules ?? d.lmRules.rules},
            tui: {...d.tui, ...o.tui},
            prompts: {...d.prompts, ...o.prompts},
        };
    }

  private createCommandRegistry(): CommandRegistry {
    const r = new CommandRegistry();
    for (const cmd of [coreCommands, memoryCommands, narCommands, configCommands, episodesCommands, scenarioCommands].flat()) r.register(cmd);
    return r;
  }

    private createPipeline(): MessagePipeline {
        const preset = this.config.pipeline.preset ?? 'default';
        const factories = this.config.pipeline.stages
            ? this.config.pipeline.stages.map(s => typeof s === 'function' ? s : (() => s))
            : PRESETS[preset]!;
        return new MessagePipeline(factories.map(f => f({commands: this.commands, episodicMemory: this.episodicMemory})));
    }

    getCapabilities(): Capabilities { return this.capabilities; }

    getConnectionInfo(msg: IOMessage, respondFn: (text: string | StreamChunk) => Promise<void>): ConnectionInfo {
        return {
            id: msg.source, type: (msg.metadata?.connectionType as ChannelType) ?? 'cli', sender: msg.sender,
            respond: respondFn,
            stream: async (s: AsyncIterable<StreamChunk>) => {
                let buf = ''; for await (const c of s) buf += c.content; await respondFn(buf);
            },
        };
    }

    createContext(connInfo: ConnectionInfo, conversation: ReturnType<ConversationStateManager['getOrCreate']>): BotContext {
        return {
            profile: this.profile, lm: this.lm, seNARS: this.nar, connection: connInfo, conversation,
            turn: {
                input: {id: crypto.randomUUID(), source: connInfo.id, sender: connInfo.sender, text: '', timestamp: Date.now()},
                classification: {primary: 'chat', confidence: 0.1, signals: []},
                reasoningTriggered: false, lmSuggestsReasoning: false, toolResults: [], actions: [],
                finalResponse: '', directives: [], directiveResults: [], passCount: 0, needsLoopBack: false,
                commandResponses: [],
            },
            config: this.config, capabilities: this.capabilities,
            metrics: {startTime: Date.now(), stages: new Map()}, events: this.events,
        };
    }

    async processMessage(msg: IOMessage, connInfo: ConnectionInfo, conversation: ReturnType<ConversationStateManager['getOrCreate']>): Promise<BotResponse> {
        const ctx = this.createContext(connInfo, conversation);
        const response = await this.pipeline.process(msg, ctx);
        conversation.addMessage({role: 'user', content: msg.text, timestamp: Date.now()}, this.lm);
        conversation.addMessage({
            role: 'assistant', content: response.text, timestamp: Date.now(),
            metadata: ctx.turn.lmSuggestsReasoning ? {suggestsReasoning: true} : undefined,
        }, this.lm);
        if (ctx.turn.reasoningResult) {
            conversation.addArtifact({type: 'derivation', content: `Derived ${ctx.turn.reasoningResult.steps} belief(s)`, timestamp: Date.now()});
        }
        return response;
    }

    on<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void { this.events.on(event, cb); }
    off<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void { this.events.off(event, cb); }

    setConnectionManager(m: ConnectionManager): void { this.connectionManager = m; }

    async addConnection(config: ConnectionConfig): Promise<import('../io/types.js').Connection> {
        if (!this.connectionManager) throw new Error('ConnectionManager not set');
        return this.connectionManager.addConnection(config, {
            nar: this.nar, emit: (e: string, d: unknown) => this.events.emit(e as keyof PipelineEvents, d as PipelineEvents[keyof PipelineEvents]),
        });
    }

    async start(): Promise<void> { this.logger.info(`Bot started: ${this.profile.name} (${this.capabilities.mode})`); }

    async stop(): Promise<void> {
        await this.connectionManager?.shutdownAll();
        this.agenticLoop?.stop();
        this.logger.info('Bot stopped');
    }

    startAgenticLoop(loop: {setMessageHandler: (h: (msg: IOMessage) => Promise<void>) => void; start: () => void; stop: () => void}): void {
        if (!this.nar) return;
        this.agenticLoop = loop;
        loop.setMessageHandler(async (msg) => {
            const connInfo = {
                id: msg.source, type: 'cli' as const, sender: msg.sender,
                respond: async (text: string | {content: string}) => {
                    const content = typeof text === 'string' ? text : text.content;
                    const conn = this.connectionManager?.getConnection(msg.source);
                    conn ? await conn.send(msg.sender, content) : console.log(content);
                },
                stream: async () => {},
            };
            const state = this.stateManager.getOrCreate(msg.sender);
            await this.processMessage(msg, connInfo, state);
        });
        loop.start();
    }
}
