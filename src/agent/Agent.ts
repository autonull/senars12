import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import {MessagePipeline, PRESETS, type StageFactory} from './pipeline/index.js';
import {ConversationStateManager} from './ConversationStateManager.js';
import type {BotContext, BotResponse, BotConfig, Capabilities, ConnectionInfo, IOMessage, PipelineEvents, StreamChunk} from './BotContext.js';
import {detectCapabilities, PipelineEventEmitter} from './BotContext.js';
import {BotProfile} from './BotProfile.js';
import type {ChannelType} from './ChannelBehavior.js';
import {CommandRegistry} from '../io/commands/registry.js';
import {coreCommands} from '../io/commands/core.js';
import {connectionCommands} from '../io/commands/connection.js';
import {memoryCommands} from '../io/commands/memory.js';
import {narCommands} from '../io/commands/nar.js';
import {selfCommands} from '../io/commands/self.js';
import {lmCommands} from '../io/commands/lm.js';
import {rlfpCommands} from '../io/commands/rlfp.js';
import {authCommands} from '../io/commands/auth.js';
import {configCommands} from '../io/commands/config.js';
import {scenarioCommands} from '../io/commands/scenario.js';
import {benchmarkCommands} from '../io/commands/benchmark.js';
import {experimentCommands} from '../io/commands/experiment.js';
import {episodesCommands} from '../io/commands/episodes.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {ConnectionManager} from '../io/connection-manager.js';
import {CLIConnection} from '../io/connections/cli.js';
import {IRCConnection} from '../io/connections/irc.js';
import {WSConnection} from '../io/connections/ws.js';
import {HTTPConnection} from '../io/connections/http.js';
import {MCPConnection} from '../io/connections/mcp.js';
import type {ConnectionConfig, Connection} from '../io/types.js';
import {AuthManager} from '../io/auth.js';
import type {AgenticLoopConfig} from './AgenticLoop.js';
import {createLogger} from '../nar/logger/index.js';
import type {Logger} from '../nar/logger/index.js';

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

export interface AgentDeps {
    profile: BotProfile;
    lm?: LMClient;
    nar?: NAR;
    pipeline?: MessagePipeline;
    stateManager?: ConversationStateManager;
    config?: Partial<BotConfig>;
    capabilities?: Capabilities;
    episodicMemory?: EpisodicMemory;
    logger?: Logger;
    commands?: CommandRegistry;
}

export interface AgentConfig {
    nar: NAR;
    logger?: Logger;
    botProfile?: Partial<BotProfile>;
}

export interface ChannelContext {
    connectionId: string;
    connectionType: ChannelType;
    sender: string;
    respond: (text: string) => Promise<void>;
}

export interface ChannelResponse {
    text: string;
    type: 'belief' | 'question' | 'goal' | 'command' | 'chat';
    actions?: string[];
    metadata?: Record<string, unknown>;
}

export class Agent {
    readonly profile: BotProfile;
    readonly pipeline: MessagePipeline;
    readonly stateManager: ConversationStateManager;
    readonly config: BotConfig;
    readonly capabilities: Capabilities;
    readonly events: PipelineEventEmitter;
    readonly commands: CommandRegistry;
    readonly episodicMemory?: EpisodicMemory;
    readonly authManager: AuthManager;

    private readonly lm?: LMClient;
    private readonly nar?: NAR;
    private readonly connectionManager: ConnectionManager;
    private readonly logger: Logger;
    private agenticLoop?: {setMessageHandler: (h: (msg: IOMessage) => Promise<void>) => void; start: () => void; stop: () => void};
    private running = false;

    constructor(deps: AgentDeps);
    constructor(config: AgentConfig);
    constructor(depsOrConfig: AgentDeps | AgentConfig) {
        const isConfig = 'nar' in depsOrConfig && !('profile' in depsOrConfig);
        const baseLogger = isConfig ? (depsOrConfig as AgentConfig).logger ?? createLogger({scope: 'agent'}) : (depsOrConfig as AgentDeps).logger ?? createLogger({scope: 'agent'});

        if (isConfig) {
            const config = depsOrConfig as AgentConfig;
            this.logger = baseLogger;
            this.profile = Object.assign(new BotProfile(), config.botProfile ?? {});
            this.lm = undefined;
            this.nar = config.nar;
            this.episodicMemory = undefined;
            this.capabilities = detectCapabilities(undefined, config.nar);
            this.config = this.mergeConfig(DEFAULT_BOT_CONFIG, {});
            this.events = new PipelineEventEmitter();
            this.stateManager = new ConversationStateManager(this.config);
            this.commands = this.createCommandRegistry();
            this.pipeline = this.createPipeline();
            this.connectionManager = new ConnectionManager(this.logger);
            this.authManager = new AuthManager();
        } else {
            const deps = depsOrConfig as AgentDeps;
            this.logger = baseLogger;
            this.profile = deps.profile;
            this.lm = deps.lm;
            this.nar = deps.nar;
            this.episodicMemory = deps.episodicMemory;
            this.capabilities = deps.capabilities ?? detectCapabilities(this.lm, this.nar);
            this.config = this.mergeConfig(DEFAULT_BOT_CONFIG, deps.config ?? {});
            this.events = new PipelineEventEmitter();
            this.stateManager = deps.stateManager ?? new ConversationStateManager(this.config);
            this.commands = deps.commands ?? this.createCommandRegistry();
            this.pipeline = deps.pipeline ?? this.createPipeline();
            this.connectionManager = new ConnectionManager(this.logger);
            this.authManager = new AuthManager();
        }
    }

    private mergeConfig(d: BotConfig, o: Partial<BotConfig> | undefined): BotConfig {
        return {
            reasoning: {...d.reasoning, ...o?.reasoning},
            streaming: {...d.streaming, ...o?.streaming},
            conversation: {...d.conversation, ...o?.conversation},
            pipeline: {...d.pipeline, ...o?.pipeline, loopBackOn: o?.pipeline?.loopBackOn ?? d.pipeline.loopBackOn},
            directives: {...d.directives, ...o?.directives},
            nlParsers: {...d.nlParsers, ...o?.nlParsers},
            classifier: {...d.classifier, ...o?.classifier},
            lmRules: {...d.lmRules, ...o?.lmRules, rules: o?.lmRules?.rules ?? d.lmRules.rules},
            tui: {...d.tui, ...o?.tui},
            prompts: {...d.prompts, ...o?.prompts},
        };
    }

    private createCommandRegistry(): CommandRegistry {
        const r = new CommandRegistry();
        for (const cmd of [coreCommands, connectionCommands, memoryCommands, narCommands, selfCommands, lmCommands, rlfpCommands, authCommands, configCommands, scenarioCommands, benchmarkCommands, experimentCommands, episodesCommands].flat()) {
            r.register(cmd);
        }
        return r;
    }

    private createPipeline(): MessagePipeline {
        const preset = this.config.pipeline.preset ?? 'default';
        const factories = this.config.pipeline.stages
            ? this.config.pipeline.stages.map(s => typeof s === 'function' ? s : (() => s))
            : PRESETS[preset]!;
        return new MessagePipeline(factories.map(f => f({commands: this.commands, episodicMemory: this.episodicMemory})));
    }

    private registerConnectionFactories(): void {
        this.connectionManager.registerFactory({type: 'cli', create: (config, deps) => new CLIConnection(config, deps)});
        this.connectionManager.registerFactory({type: 'irc', create: (config, deps) => new IRCConnection(config, deps)});
        this.connectionManager.registerFactory({type: 'websocket', create: (config, deps) => new WSConnection(config, deps)});
        this.connectionManager.registerFactory({type: 'http', create: (config, deps) => new HTTPConnection(config, deps)});
        this.connectionManager.registerFactory({type: 'mcp', create: (config, deps) => new MCPConnection(config, deps)});
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

    async processMessage(msg: IOMessage, connInfo: ConnectionInfo, conversation: ReturnType<ConversationStateManager['getOrCreate']>): Promise<BotResponse>;
    async processMessage(text: string, ctx: ChannelContext): Promise<ChannelResponse>;
    async processMessage(msgOrText: IOMessage | string, connInfoOrCtx: ConnectionInfo | ChannelContext, conversation?: ReturnType<ConversationStateManager['getOrCreate']>): Promise<BotResponse | ChannelResponse> {
        if (typeof msgOrText === 'string') {
            return this.processMessageLegacy(msgOrText, connInfoOrCtx as ChannelContext);
        }

        const msg = msgOrText;
        const connInfo = connInfoOrCtx as ConnectionInfo;
        const conv = conversation!;

        const authResult = this.authManager.checkAuth(connInfo.id, connInfo.sender, msg.text);
        if (authResult === 'ignore') {
            return {text: '', reasoning: undefined, actions: []};
        }
        if (authResult === 'auth_bound') {
            this.authManager.bindUser(connInfo.id, connInfo.sender);
            return {text: 'Authenticated successfully', reasoning: undefined, actions: []};
        }

        const ctx = this.createContext(connInfo, conv);
        const response = await this.pipeline.process(msg, ctx);
        conv.addMessage({role: 'user', content: msg.text, timestamp: Date.now()}, this.lm);
        conv.addMessage({
            role: 'assistant', content: response.text, timestamp: Date.now(),
            metadata: ctx.turn.lmSuggestsReasoning ? {suggestsReasoning: true} : undefined,
        }, this.lm);
        if (ctx.turn.reasoningResult) {
            conv.addArtifact({type: 'derivation', content: `Derived ${ctx.turn.reasoningResult.steps} belief(s)`, timestamp: Date.now()});
        }
        return response;
    }

    private async processMessageLegacy(text: string, ctx: ChannelContext): Promise<ChannelResponse> {
        const authResult = this.authManager.checkAuth(ctx.connectionId, ctx.sender, text);
        if (authResult === 'ignore') {
            return {text: '', type: 'chat'};
        }
        if (authResult === 'auth_bound') {
            this.authManager.bindUser(ctx.connectionId, ctx.sender);
            return {text: 'Authenticated successfully', type: 'chat'};
        }

        const state = this.stateManager.getOrCreate(ctx.sender);
        const connInfo = this.getConnectionInfo(
            {id: crypto.randomUUID(), source: ctx.connectionId, sender: ctx.sender, text, timestamp: Date.now()},
            async (t: string | StreamChunk) => { await ctx.respond(typeof t === 'string' ? t : t.content); },
        );
        const response = await this.processMessage(
            {id: crypto.randomUUID(), source: ctx.connectionId, sender: ctx.sender, text, timestamp: Date.now()},
            connInfo,
            state,
        );
        return {text: response.text, type: 'chat', actions: response.actions.map(a => a.content)};
    }

    on<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void { this.events.on(event, cb); }
    off<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void { this.events.off(event, cb); }

    async addConnection(config: ConnectionConfig): Promise<Connection> {
        if (config.authSecret) {
            this.authManager.setSecret(config.id, config.authSecret);
        }
        return this.connectionManager.addConnection(config, {
            nar: this.nar, emit: (e: string, d: unknown) => this.events.emit(e as keyof PipelineEvents, d as PipelineEvents[keyof PipelineEvents]),
        });
    }

    async removeConnection(id: string): Promise<void> {
        this.authManager.clearConnection(id);
        await this.connectionManager.removeConnection(id);
    }

    async enableConnection(id: string): Promise<void> {
        await this.connectionManager.enableConnection(id);
    }

    async disableConnection(id: string): Promise<void> {
        await this.connectionManager.disableConnection(id);
    }

    getConnection(id: string): Connection | undefined {
        return this.connectionManager.getConnection(id);
    }

    getConnections(): ReadonlyMap<string, Connection> {
        return this.connectionManager.getConnections();
    }

    getAuthManager(): AuthManager {
        return this.authManager;
    }

    getNAR(): NAR | undefined {
        return this.nar;
    }

    getCommands(): CommandRegistry {
        return this.commands;
    }

    async sendTo(connectionId: string, target: string, text: string): Promise<void> {
        const connection = this.connectionManager.getConnection(connectionId);
        if (connection) {
            await connection.send(target, text);
        }
    }

    async broadcast(text: string, exclude: string[] = []): Promise<void> {
        for (const [id, connection] of this.connectionManager.getConnections()) {
            if (!exclude.includes(id)) {
                await connection.send('broadcast', text);
            }
        }
    }

    async start(): Promise<void> {
        if (this.running) return;
        this.running = true;
        this.registerConnectionFactories();
        this.logger.info(`Agent started: ${this.profile.name} (${this.capabilities.mode})`);
    }

    async stop(): Promise<void> {
        if (!this.running) return;
        this.running = false;
        await this.connectionManager.shutdownAll();
        this.agenticLoop?.stop();
        this.logger.info('Agent stopped');
    }

    startAgenticLoop(loop: {setMessageHandler: (h: (msg: IOMessage) => Promise<void>) => void; start: () => void; stop: () => void}): void {
        if (!this.nar) return;
        this.agenticLoop = loop;
        loop.setMessageHandler(async (msg) => {
            const connInfo = {
                id: msg.source, type: 'cli' as const, sender: msg.sender,
                respond: async (text: string | {content: string}) => {
                    const content = typeof text === 'string' ? text : text.content;
                    const conn = this.connectionManager.getConnection(msg.source);
                    conn ? await conn.send(msg.sender, content) : console.log(content);
                },
                stream: async () => {},
            };
            const state = this.stateManager.getOrCreate(msg.sender);
            await this.processMessage(msg, connInfo, state);
        });
        loop.start();
    }

    getSnapshot(): {
        turn: number;
        concepts: number;
        tasks: number;
        lmStatus: string;
        workingMemory: number;
    } {
        const stats = this.nar?.getStatistics();
        return {
            turn: 0,
            concepts: stats?.totalConcepts ?? 0,
            tasks: stats?.totalTasks ?? 0,
            lmStatus: 'unknown',
            workingMemory: this.nar?.workingMemory?.size() ?? 0,
        };
    }
}