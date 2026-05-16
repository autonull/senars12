import type {NAR} from '../../nar/nar.js';
import type {CommandContext, CommandDefinition} from './registry.js';

export const requireArgs = (args: string[], min: number, usage: string): string | null =>
    args.length < min ? `Usage: ${usage}` : null;

export const getNarFeature = <T>(nar: NAR, getter: (n: NAR) => T | undefined, notFound: string): T | string => {
    const feature = getter(nar);
    return feature ?? notFound;
};

export const cmd = (name: string, description: string, usage: string, execute: (args: string[], ctx: CommandContext) => Promise<string>): CommandDefinition =>
    ({name, description, usage, execute});

export const singleArgCmd = (usage: string, action: (arg: string, ctx: CommandContext) => Promise<string>) =>
    async (args: string[], ctx: CommandContext) => {
        const usageMsg = `Usage: ${usage}`;
        if (args.length < 1) return usageMsg;
        const [arg] = args;
        if (!arg) return usageMsg;
        return action(arg, ctx);
    };
