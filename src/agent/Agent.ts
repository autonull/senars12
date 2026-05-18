import {EventEmitter} from 'events';
import type {NAR} from '../nar/nar.js';
import {errMsg} from '../nar/utils/helpers.js';
import {createLogger, type Logger} from '../nar/logger/index.js';
import {ConnectionManager} from '../io/connection-manager.js';
import {MessageRouter} from '../io/router.js';
import {type CommandContext, CommandRegistry} from '../io/commands/registry.js';
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
import {AuthManager} from '../io/auth.js';
import type {Connection, ConnectionConfig, IOMessage, MessageClassification} from '../io/types.js';
import {CLIConnection} from '../io/connections/cli.js';
import {IRCConnection} from '../io/connections/irc.js';
import {WSConnection} from '../io/connections/ws.js';
import {HTTPConnection} from '../io/connections/http.js';
import {MCPConnection} from '../io/connections/mcp.js';
import {ChatResponder, type ChatResponderConfig} from './ChatResponder.js';
import {ResponseInterpreter, type ResponseInterpreterConfig} from './ResponseInterpreter.js';
import {DegradationManager} from './DegradationManager.js';
import {ResponseFormatter} from './ResponseFormatter.js';
import {BotProfile} from './BotProfile.js';
import {ConversationManager} from './ConversationManager.js';
import {LastResults, type LastResultsEntry} from './LastResults.js';
import {SkillCatalog} from './SkillCatalog.js';
import type {ChannelType} from './ChannelBehavior.js';

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

export interface AgentConfig {
    nar: NAR;
    logger?: Logger;
    chatResponder?: ChatResponderConfig | false;
    skillCatalog?: boolean;
    responseInterpreter?: ResponseInterpreterConfig | false;
    degradationManager?: boolean;
    responseFormatter?: boolean;
    botProfile?: Partial<BotProfile>;
    conversationManager?: boolean;
    lastResults?: {maxRecent?: number};
}

export class Agent {
    readonly router: MessageRouter;
    readonly nar: NAR;
    readonly skillCatalog: SkillCatalog;
    readonly lastResults: LastResults;
    readonly responseInterpreter: ResponseInterpreter;
    readonly degradationManager: DegradationManager;
    readonly responseFormatter: ResponseFormatter;
    readonly botProfile: BotProfile;
    readonly conversationManager: ConversationManager;

    private readonly manager: ConnectionManager;
    private readonly commands: CommandRegistry;
    private readonly emitter: EventEmitter;
    private readonly logger: Logger;
    private readonly authManager: AuthManager;
    private readonly chatResponder?: ChatResponder;
    private running = false;

    constructor(config: AgentConfig) {
        this.nar = config.nar;
        this.emitter = new EventEmitter();
        this.logger = config.logger ?? createLogger({scope: 'agent'});
        this.manager = new ConnectionManager(this.logger);
        this.router = new MessageRouter();
        this.commands = new CommandRegistry();
        this.authManager = new AuthManager();

        this.skillCatalog = new SkillCatalog(this.nar);
        this.lastResults = new LastResults();
        this.degradationManager = new DegradationManager();
        this.conversationManager = new ConversationManager();
this.botProfile = Object.assign(new BotProfile(), config.botProfile ?? {});
this.responseFormatter = new ResponseFormatter();

        this.responseInterpreter = config.responseInterpreter !== false
            ? new ResponseInterpreter(this.nar, config.responseInterpreter)
            : new ResponseInterpreter(this.nar, {extractionMode: 'none'});

if (config.chatResponder !== false) {
            const crConfig: ChatResponderConfig = {
                nar: this.nar,
                name: this.botProfile.name,
                personality: this.botProfile.personality,
                skillCatalog: config.skillCatalog !== false ? this.skillCatalog : undefined,
                lastResults: this.lastResults,
                degradationManager: config.degradationManager !== false ? this.degradationManager : undefined,
                ...(typeof config.chatResponder === 'object' ? config.chatResponder : {}),
            };
            this.chatResponder = new ChatResponder(crConfig);
        }

        this.registerConnectionFactories();
        this.registerCommands();
    }

    getAuthManager(): AuthManager {
        return this.authManager;
    }

    async addConnection(config: ConnectionConfig): Promise<Connection> {
        if (config.authSecret) {
            this.authManager.setSecret(config.id, config.authSecret);
        }
        return this.manager.addConnection(config, {
            nar: this.nar,
            emit: (event, data) => this.emitter.emit(event, data)
        });
    }

    async removeConnection(id: string): Promise<void> {
        this.authManager.clearConnection(id);
        await this.manager.removeConnection(id);
    }

    async enableConnection(id: string): Promise<void> {
        await this.manager.enableConnection(id);
    }

    async disableConnection(id: string): Promise<void> {
        await this.manager.disableConnection(id);
    }

    getConnection(id: string): Connection | undefined {
        return this.manager.getConnection(id);
    }

    getConnections(): ReadonlyMap<string, Connection> {
        return this.manager.getConnections();
    }

    async start(): Promise<void> {
        if (this.running) return;
        this.running = true;
        this.skillCatalog.updateFromCommands(this.commands.commands);
        this.logger.info('Agent started');
    }

    async stop(): Promise<void> {
        if (!this.running) return;
        this.running = false;
        await this.manager.shutdownAll();
        this.logger.info('Agent stopped');
    }

    async sendTo(connectionId: string, target: string, text: string): Promise<void> {
        const connection = this.manager.getConnection(connectionId);
        if (connection) {
            await connection.send(target, text);
        }
    }

    async broadcast(text: string, exclude: string[] = []): Promise<void> {
        for (const [id, connection] of this.manager.getConnections()) {
            if (!exclude.includes(id)) {
                await connection.send('broadcast', text);
            }
        }
    }

    async requestConnection(type: string, config: Record<string, unknown>): Promise<void> {
        const id = config.id as string ?? `conn-${crypto.randomUUID()}`;
        const connectionConfig: ConnectionConfig = {
            id,
            type,
            enabled: true,
            config
        };
        await this.addConnection(connectionConfig);
        this.emitter.emit('connection:requested', {type, config});
    }

    async saveState(path?: string): Promise<void> {
        const fs = await import('fs/promises');
        const statePath = path ?? 'agent-state.json';
        const connections: Array<{ id: string; type: string; state: string }> = [];
        for (const [id, conn] of this.manager.getConnections()) {
            connections.push({id, type: conn.type, state: conn.state});
        }
        await fs.writeFile(statePath, JSON.stringify({
            connections,
            memory: await this.nar.getMemoryState?.() ?? {},
            timestamp: Date.now()
        }, null, 2));
    }

    async loadState(path?: string): Promise<void> {
        const fs = await import('fs/promises');
        const statePath = path ?? 'agent-state.json';
        const data = JSON.parse(await fs.readFile(statePath, 'utf-8'));
        if (data.memory) {
            await this.nar.loadMemoryState?.(data.memory);
        }
    }

    on(event: string, handler: (...args: unknown[]) => void): void {
        this.emitter.on(event, handler);
    }

    off(event: string, handler: (...args: unknown[]) => void): void {
        this.emitter.off(event, handler);
    }

    getNAR(): NAR {
        return this.nar;
    }

    getCommands(): CommandRegistry {
        return this.commands;
    }

    async processMessage(text: string, ctx: ChannelContext): Promise<ChannelResponse> {
        const authResult = this.authManager.checkAuth(ctx.connectionId, ctx.sender, text);
        if (authResult === 'ignore') {
            return {text: '', type: 'chat'};
        }
        if (authResult === 'auth_bound') {
            this.authManager.bindUser(ctx.connectionId, ctx.sender);
            return {text: 'Authenticated successfully', type: 'chat'};
        }

        const classification = this.classifyInput(text);

        switch (classification) {
            case 'command': {
                const parts = text.slice(1).split(/\s+/);
                const cmdName = text.trim().startsWith('/') ? '/' + parts[0]! : '.' + parts[0]!;
                const args = parts.slice(1);
                try {
                    const cmdContext: CommandContext = {
                        nar: this.nar,
                        connection: this.getConnection(ctx.connectionId) ?? {
                            id: ctx.connectionId,
                            name: ctx.connectionType,
                            type: ctx.connectionType,
                            state: 'connected',
                            connect: async () => {},
                            disconnect: async () => {},
                            reconnect: async () => {},
                            send: async () => {},
                            onMessage: () => {},
                            onStateChange: () => {},
                            onError: () => {},
                            getStatus: () => ({state: 'connected', messageCount: 0, errorCount: 0}),
                            reconfigure: async () => {},
                        },
                        manager: this.manager,
                    };
                    const result = await this.commands.execute(cmdName, args, cmdContext);
                    this.lastResults.record(text, result, [cmdName]);
                    return {text: result, type: 'command'};
                } catch (error) {
                    return {text: `Error: ${errMsg(error)}`, type: 'command'};
                }
            }
            case 'belief': {
                await this.nar.believe(text);
                const derived = await this.nar.run(3);
                const response = `Added: ${text}${derived > 0 ? ` (derived ${derived})` : ''}`;
                this.lastResults.record(text, response);
                this.conversationManager.addMessage(ctx.sender, 'user', text);
                this.conversationManager.addMessage(ctx.sender, 'assistant', response);
                return {text: response, type: 'belief'};
            }
            case 'question': {
                await this.nar.question(text);
                const derived = await this.nar.run(5);
                const response = derived > 0 ? `Derived ${derived} belief(s)` : 'No derivation found';
                this.lastResults.record(text, response);
                this.conversationManager.addMessage(ctx.sender, 'user', text);
                this.conversationManager.addMessage(ctx.sender, 'assistant', response);
                return {text: response, type: 'question'};
            }
            case 'goal': {
                await this.nar.goal(text.slice(1));
                const response = `Goal registered: ${text.slice(1)}`;
                this.lastResults.record(text, response);
                return {text: response, type: 'goal'};
            }
            case 'natural-language':
            default: {
                if (this.chatResponder) {
                    const response = await this.chatResponder.respond(text);
                    const interpreted = this.responseInterpreter.interpret(response);
                    if (interpreted.hasActions) {
                        const actionResult = await this.responseInterpreter.executeAndRespond(interpreted);
                        this.lastResults.record(text, actionResult, interpreted.actions.map(a => a.raw));
                    } else {
                        this.lastResults.record(text, response);
                    }
                    this.conversationManager.addMessage(ctx.sender, 'user', text);
                    this.conversationManager.addMessage(ctx.sender, 'assistant', response);
                    return {
                        text: response,
                        type: 'chat',
                        actions: interpreted.hasActions ? interpreted.actions.map(a => a.raw) : undefined
                    };
                }
                return {text: `Processed: ${text}`, type: 'chat'};
            }
        }
    }

    getSnapshot(): {
        turn: number;
        concepts: number;
        tasks: number;
        lmStatus: string;
        workingMemory: number;
    } {
        const stats = this.nar.getStatistics();
        return {
            turn: this.lastResults.getHistory().length,
            concepts: stats?.totalConcepts ?? 0,
            tasks: stats?.totalTasks ?? 0,
            lmStatus: this.degradationManager.reportStatus(),
            workingMemory: this.nar.workingMemory.size(),
        };
    }

    private registerConnectionFactories(): void {
        const factories = [
            {type: 'cli', ctor: CLIConnection},
            {type: 'irc', ctor: IRCConnection},
            {type: 'websocket', ctor: WSConnection},
            {type: 'http', ctor: HTTPConnection},
            {type: 'mcp', ctor: MCPConnection},
        ] as const;
        for (const {type, ctor} of factories) {
            this.manager.registerFactory({type, create: (config, deps) => new ctor(config, deps)});
        }
    }

  private registerCommands(): void {
    for (const cmd of [coreCommands, connectionCommands, memoryCommands, narCommands, selfCommands, lmCommands, rlfpCommands, authCommands, configCommands, scenarioCommands, benchmarkCommands, experimentCommands, episodesCommands].flat()) {
      this.commands.register(cmd);
    }
  }

    private classifyInput(text: string): MessageClassification {
        const trimmed = text.trim();
        if (trimmed.startsWith('.') || trimmed.startsWith('/')) return 'command';
        if (trimmed.endsWith('.')) return 'belief';
        if (trimmed.endsWith('?')) return 'question';
        if (trimmed.startsWith('!')) return 'goal';
        return 'natural-language';
    }
}