import type {CommandContext} from './registry.js';

export const requireNar = (ctx: CommandContext): { ok: true; nar: NonNullable<CommandContext['nar']> } | {
    ok: false;
    message: string
} =>
    ctx.nar ? {ok: true, nar: ctx.nar} : {ok: false, message: 'NAR not configured'};

export const requireManager = (ctx: CommandContext): { ok: true; manager: NonNullable<CommandContext['manager']> } | {
    ok: false;
    message: string
} =>
    ctx.manager ? {ok: true, manager: ctx.manager} : {ok: false, message: 'Connection manager not configured'};

export const singleArgCmd = (usage: string, action: (arg: string, ctx: CommandContext) => Promise<string>) =>
    async (args: string[], ctx: CommandContext) => {
        const usageMsg = `Usage: ${usage}`;
        if (args.length < 1) return usageMsg;
        const [arg] = args;
        if (!arg) return usageMsg;
        return action(arg, ctx);
    };
