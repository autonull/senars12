import type {CommandContext} from './registry.js';

export const singleArgCmd = (usage: string, action: (arg: string, ctx: CommandContext) => Promise<string>) =>
    async (args: string[], ctx: CommandContext) => {
        const usageMsg = `Usage: ${usage}`;
        if (args.length < 1) return usageMsg;
        const [arg] = args;
        if (!arg) return usageMsg;
        return action(arg, ctx);
    };
