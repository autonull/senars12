import type {ConnectionConfig, ConnectionDeps} from '../types.js';
import {BaseConnection} from './base.js';
import {createLogger} from '../../nar/logger/index.js';

export interface MCPToolResult {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}

export interface MCPToolCall {
    name: string;
    arguments?: Record<string, unknown>;
}

export class MCPConnection extends BaseConnection {
    override readonly id: string;
    override readonly name: string;
    override readonly type = 'mcp';
    override readonly logger = createLogger({scope: 'io:mcp'});
    private transport: 'stdio' | 'sse' = 'stdio';
    private process: ReturnType<typeof import('child_process').spawn> | null = null;
    private tools: Map<string, { description: string; inputSchema: Record<string, unknown> }> = new Map();

    constructor(config: ConnectionConfig, deps: ConnectionDeps) {
        super(config, deps);
        this.id = config.id;
        this.name = config.config.name as string ?? 'MCP';
        this.transport = (config.config.transport as 'stdio' | 'sse') ?? 'stdio';
    }

    override async connect(): Promise<void> {
        if (this.state === 'connected') return;
        this.setState('connecting');

        if (this.transport === 'stdio') {
            await this.connectStdio();
        } else {
            this.setState('connected');
        }
    }

    override async disconnect(reason?: string): Promise<void> {
        if (this.state === 'disconnected' || this.state === 'idle') return;

        this.setState('disconnecting');

        if (this.process) {
            this.process.kill();
            this.process = null;
        }

        this.setState('disconnected');
        this.logger.info(`MCP connection ${this.id} disconnected: ${reason ?? 'normal'}`);
    }

    async send(target: string, text: string): Promise<void> {
        if (!this.process?.stdin) return;

        const parts = target.split(':');
        const toolName = parts[0];
        const operation = parts[1] ?? 'call';

        const message = {
            jsonrpc: '2.0',
            id: crypto.randomUUID(),
            method: operation,
            params: {
                name: toolName,
                arguments: text ? JSON.parse(text) : {},
            },
        };

        this.process.stdin.write(JSON.stringify(message) + '\n');
    }

    async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
        return new Promise((resolve) => {
            const id = crypto.randomUUID();
            const message = {
                jsonrpc: '2.0',
                id,
                method: 'tools/call',
                params: {name, arguments: args},
            };

            const timeout = setTimeout(() => {
                resolve({
                    content: [{type: 'text', text: JSON.stringify({error: 'Tool call timeout'})}],
                    isError: true,
                });
            }, 30000);

            const originalHandler = this.messageHandler;
            this.messageHandler = async (msg) => {
                clearTimeout(timeout);
                this.messageHandler = originalHandler;
                resolve({
                    content: [{type: 'text', text: msg.text}],
                    isError: false,
                });
            };

            this.process?.stdin?.write(JSON.stringify(message) + '\n');
        });
    }

    getTools(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
        return Array.from(this.tools.values()).map(t => ({
            name: t.description,
            description: t.description,
            inputSchema: t.inputSchema,
        }));
    }

    private async connectStdio(): Promise<void> {
        const command = this.config.config.command as string;
        const args = (this.config.config.args as string[]) ?? [];

        if (!command) {
            throw new Error('MCP stdio transport requires command in config');
        }

        return new Promise((resolve, reject) => {
            const {spawn} = require('child_process') as typeof import('child_process');
            this.process = spawn(command, args, {stdio: 'pipe'});

            let buffer = '';

            this.process.stdout?.on('data', (data: Buffer) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (line.trim()) {
                        this.handleMCPMessage(JSON.parse(line));
                    }
                }
            });

            this.process.stderr?.on('data', (data: Buffer) => {
                this.logger.error(`MCP stderr: ${data.toString()}`);
            });

            this.process.on('error', (err) => {
                this.handleError(this.createError(err.message, 'MCP_SPAWN_ERROR', true, err));
                reject(err);
            });

            this.process.on('close', (code) => {
                this.setState('disconnected');
                if (code !== 0) {
                    this.handleError(this.createError(`MCP process exited with code ${code}`, 'MCP_EXIT', false));
                }
            });

            setTimeout(() => {
                this.setState('connected');
                this.logger.info(`MCP connection ${this.id} connected via stdio`);
                resolve();
            }, 1000);
        });
    }

    private handleMCPMessage(data: Record<string, unknown>): void {
        const method = data.method as string | undefined;

        if (method === 'notifications/tools/list_changed') {
            this.discoverTools();
            return;
        }

        if (method === 'tools/list') {
            const tools = (data.params as {
                result: { tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> }
            })?.result?.tools ?? [];
            this.tools.clear();
            for (const tool of tools) {
                this.tools.set(tool.name, {
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                });
            }
            return;
        }

        if (method === 'tools/call') {
            const params = data.params as { name: string; arguments: Record<string, unknown> };
            this.handleMessage(this.createMessage('mcp-client', JSON.stringify({tool: params.name, args: params.arguments}), {toolCall: true}));
        }
    }

    private discoverTools(): void {
        if (!this.process?.stdin) return;

        const message = {
            jsonrpc: '2.0',
            id: crypto.randomUUID(),
            method: 'tools/list',
            params: {},
        };

        this.process.stdin.write(JSON.stringify(message) + '\n');
    }
}