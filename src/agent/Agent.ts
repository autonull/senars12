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
import type {Connection, ConnectionConfig, IOMessage, MessageClassification} from '../io/types.js';
import {CLIConnection} from '../io/connections/cli.js';
import {IRCConnection} from '../io/connections/irc.js';
import {WSConnection} from '../io/connections/ws.js';
import {HTTPConnection} from '../io/connections/http.js';
import {MCPConnection} from '../io/connections/mcp.js';
import {ChatResponder} from './ChatResponder.js';

export class Agent {
    readonly router: MessageRouter;
    private readonly nar: NAR;
    private readonly manager: ConnectionManager;
    private readonly commands: CommandRegistry;
    private readonly emitter: EventEmitter;
    private readonly logger: Logger;
    private readonly chatResponder?: ChatResponder;
    private running = false;

    constructor(nar: NAR, logger?: Logger, chatResponder?: ChatResponder) {
        this.nar = nar;
        this.emitter = new EventEmitter();
        this.logger = logger ?? createLogger({scope: 'agent'});
        this.manager = new ConnectionManager(this.logger);
        this.router = new MessageRouter();
        this.commands = new CommandRegistry();
        this.chatResponder = chatResponder;
        this.registerConnectionFactories();
        this.registerCommands();
        this.setupMiddleware();
    }

    async addConnection(config: ConnectionConfig): Promise<Connection> {
        return this.manager.addConnection(config, {
            nar: this.nar,
            emit: (event, data) => this.emitter.emit(event, data)
        });
    }

    async removeConnection(id: string): Promise<void> {
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
        for (const cmd of [coreCommands, connectionCommands, memoryCommands, narCommands, selfCommands, lmCommands, rlfpCommands].flat()) {
            this.commands.register(cmd);
        }
    }

    private setupMiddleware(): void {
        this.router.use(async (message, context, next) => {
            if (message.text.startsWith('.')) {
                const parts = message.text.slice(1).split(/\s+/);
                const cmdName = '.' + parts[0];
                const args = parts.slice(1);
                try {
                    const cmdContext: CommandContext = {
                        nar: this.nar,
                        connection: context.connection,
                        manager: this.manager
                    };
                    const result = await this.commands.execute(cmdName, args, cmdContext);
                    await context.respond(result);
                } catch (error) {
                    await context.respond(`Error: ${errMsg(error)}`);
                }
                return;
            }
            await next();
        });

        this.router.use(async (message, context, next) => {
            const classification = this.classifyMessage(message);
            if (classification === 'belief') {
                await this.nar.believe(message.text);
                const derived = await this.nar.run(3);
                await context.respond(`Added: ${message.text}${derived > 0 ? ` (derived ${derived})` : ''}`);
                return;
            }
            if (classification === 'question') {
                await this.nar.question(message.text);
                const derived = await this.nar.run(5);
                await context.respond(derived > 0 ? `Derived ${derived} belief(s)` : 'No derivation found');
                return;
            }
            await next();
        });

        this.router.use(async (message, context) => {
            if (this.chatResponder) {
                const response = await this.chatResponder.respond(message.text);
                await context.respond(response);
            } else {
                await context.respond(`Processed: ${message.text}`);
            }
        });
    }

    private classifyMessage(message: IOMessage): MessageClassification {
        const text = message.text.trim();
        if (text.startsWith('.')) return 'command';
        if (text.endsWith('.')) return 'belief';
        if (text.endsWith('?')) return 'question';
        if (text.startsWith('!')) return 'goal';
        return 'natural-language';
    }
}