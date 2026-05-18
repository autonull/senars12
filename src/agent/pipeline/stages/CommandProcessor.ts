import type {BotContext} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import {CommandRegistry, type CommandContext, type CommandDefinition} from '../../../io/commands/registry.js';
import type {NAR} from '../../../nar/nar.js';
import type {Connection} from '../../../io/types.js';
import type {ConnectionManager} from '../../../io/connection-manager.js';

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
        const connection: Connection = {
            id: ctx.connection.id,
            name: ctx.connection.type,
            type: ctx.connection.type,
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
        };

        const cmdContext: CommandContext = {nar, connection, manager: {} as ConnectionManager};

        const requiresLM = (cmd as any).requiresLM;
        const requiresSeNARS = (cmd as any).requiresSeNARS;
        const requiresFull = (cmd as any).requiresFull;

        if (requiresLM && !ctx.capabilities.hasLM) {
            ctx.turn.finalResponse = `Command ${cmdName} requires LM (not available).`;
            return;
        }
        if (requiresSeNARS && !ctx.capabilities.hasSeNARS) {
            ctx.turn.finalResponse = `Command ${cmdName} requires SeNARS (not available).`;
            return;
        }
        if (requiresFull && (!ctx.capabilities.hasLM || !ctx.capabilities.hasSeNARS)) {
            ctx.turn.finalResponse = `Command ${cmdName} requires both LM and SeNARS.`;
            return;
        }

        try {
            const result = await this.registry.execute(cmdName, args, cmdContext);
            ctx.turn.finalResponse = result;
        } catch (error) {
            ctx.turn.finalResponse = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}