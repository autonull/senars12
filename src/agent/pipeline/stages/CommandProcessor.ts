import type {BotContext} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import {CommandRegistry, type CommandContext, type CommandDefinition} from '../../../io/commands/registry.js';
import type {NAR} from '../../../nar/nar.js';
import type {Connection, ConnectionState, ConnectionError} from '../../../io/types.js';
import type {ConnectionManager} from '../../../io/connection-manager.js';

class PipelineConnection implements Connection {
    constructor(
        readonly id: string,
        readonly name: string,
        readonly type: string,
        private _state: ConnectionState,
        private ctx: BotContext
    ) {}

    get state(): ConnectionState { return this._state; }

    async connect(): Promise<void> {}
    async disconnect(_reason?: string): Promise<void> {}
    async reconnect(): Promise<void> {}

    async send(_target: string, text: string): Promise<void> {
        this.ctx.turn.commandResponses.push(text);
    }

    async respond(_target: string, text: string): Promise<void> {
        this.ctx.turn.commandResponses.push(text);
    }

    onMessage(_handler: (message: import('../../../io/types.js').IOMessage) => Promise<void>): void {}
    onStateChange(_handler: (state: ConnectionState, prev: ConnectionState) => void): void {}
    onError(_handler: (error: ConnectionError) => void): void {}

    getStatus(): { state: ConnectionState; messageCount: number; errorCount: number } {
        return {state: 'connected', messageCount: 0, errorCount: 0};
    }

    async reconfigure(_config: Record<string, unknown>): Promise<void> {}
}

export class CommandProcessor implements PipelineStage {
    name = 'CommandProcessor';
    priority = 3;
    enabled = (ctx: BotContext) => ctx.turn.input.text.trim().startsWith('/') || ctx.turn.input.text.trim().startsWith('.');

    constructor(private registry: CommandRegistry) {}

    async execute(ctx: BotContext): Promise<void> {
        const text = ctx.turn.input.text.trim();
        const parts = text.slice(1).split(/\s+/);
        const cmdName = text.startsWith('/') ? '/' + parts[0]! : '.' + parts[0]!;
        const args = parts.slice(1);

        const cmd = this.registry.get(cmdName);
        if (!cmd) {
            ctx.turn.finalResponse = `Unknown command: ${cmdName}. Type /help for available commands.`;
            return;
        }

        const nar = ctx.seNARS!;
        const connection = new PipelineConnection(ctx.connection.id, ctx.connection.type, ctx.connection.type, 'connected', ctx);
        const cmdContext: CommandContext = {nar, connection, manager: {} as ConnectionManager};

        const cmdDef = cmd as CommandDefinition & {requiresLM?: boolean; requiresSeNARS?: boolean; requiresFull?: boolean};

        if (cmdDef.requiresLM && !ctx.capabilities.hasLM) {
            ctx.turn.finalResponse = `Command ${cmdName} requires LM (not available).`;
            return;
        }
        if (cmdDef.requiresSeNARS && !ctx.capabilities.hasSeNARS) {
            ctx.turn.finalResponse = `Command ${cmdName} requires SeNARS (not available).`;
            return;
        }
        if (cmdDef.requiresFull && (!ctx.capabilities.hasLM || !ctx.capabilities.hasSeNARS)) {
            ctx.turn.finalResponse = `Command ${cmdName} requires both LM and SeNARS.`;
            return;
        }

        try {
            const result = await this.registry.execute(cmdName, args, cmdContext);
            ctx.turn.finalResponse = ctx.turn.commandResponses.length
                ? [...ctx.turn.commandResponses, result].filter(Boolean).join('\n')
                : result;
        } catch (error) {
            ctx.turn.finalResponse = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}