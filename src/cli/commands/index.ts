import type {NAR} from '../../nar';
import type {ReasoningAboutReasoning} from '../../nar/self';
import type {RLFPLearner} from '../../nar/rlfp';
import type {LMClient} from '../../nar/lm/types.js';
import {createLogger} from '../../nar/logger';

export interface NARExtended {
    loadDomain(domain: { name: string; beliefs: string[] }): void;
    setConstitution(beliefs: Task[]): void;
    getConstitution(): Task[];
    getAttentionReport(): { concepts: Array<{ term: string; priority: number }>; total: number };
}

export interface CommandContext {
    nar: NAR & NARExtended;
    logger: ReturnType<typeof createLogger>;
    getSelf(): ReasoningAboutReasoning | undefined;
    getRLFP(): RLFPLearner | undefined;
    getLM(): LMClient | undefined;
    args?: string[];
}

type Task = import('../../nar/types').Task;

export type CommandHandler = (ctx: CommandContext, args: string[]) => void | Promise<void>;

export interface CommandDefinition {
    readonly name: string;
    readonly description: string;
    readonly usage: string;
    readonly handler: CommandHandler;
}

export class CommandRegistry {
    private readonly commands = new Map<string, CommandDefinition>();
    private readonly logger: ReturnType<typeof createLogger>;

    constructor(scope = 'CLI') {
        this.logger = createLogger({scope});
    }

    register(def: CommandDefinition): void {
        this.commands.set(def.name, def);
    }

    get(name: string): CommandDefinition | undefined {
        return this.commands.get(name);
    }

    list(): CommandDefinition[] {
        return Array.from(this.commands.values());
    }

    handle(cmd: string, ctx: CommandContext): void | Promise<void> {
        const def = this.commands.get(cmd);
        if (!def) {
            this.logger.warn(`Unknown command: ${cmd}`);
            return;
        }

        try {
            return def.handler(ctx, ctx.args ?? []);
        } catch (error) {
            this.logger.error(`Error: ${error}`);
        }
    }
}

export function createCommandContext(nar: NAR): CommandContext {
    const logger = createLogger({scope: 'CLI'});

    return {
        nar,
        logger,
        getSelf: () => nar.getSelfAnalyzer?.(),
        getRLFP: () => nar.getRLFP?.(),
        getLM: () => nar.getLMClient?.()
    };
}

export function requireArgs(ctx: CommandContext, args: string[], usage: string): args is string[] {
    if (args.length > 0) return true;
    ctx.logger.info(`Usage: ${usage}`);
    return false;
}