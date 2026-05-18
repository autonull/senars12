import type {CommandDefinition} from './registry.js';

export const coreCommands: CommandDefinition[] = [
    {
        name: '/help',
        aliases: ['.help'],
        description: 'Show help information',
        usage: '/help [command]',
        execute: async () => {
            return 'Commands:\n  (term). add belief\n  (term)? ask question\n  /run [n] run inference steps\n  /stats show statistics\n  /clear clear memory\n  /quit exit';
        }
    },
    {
        name: '/run',
        aliases: ['.run'],
        description: 'Run inference steps',
        usage: '/run [n]',
        execute: async (args, ctx) => {
            const steps = args[0] ? parseInt(args[0]) : 5;
            const derived = await ctx.nar.run(steps);
            return `Ran ${steps} step(s), derived ${derived} belief(s)`;
        }
    },
    {
        name: '/stats',
        aliases: ['.stats'],
        description: 'Show system statistics',
        usage: '/stats [detail]',
        execute: async (args, ctx) => {
            const stats = ctx.nar.getStatistics();
            let result = `Concepts: ${stats.totalConcepts}, Tasks: ${stats.totalTasks}`;
            if (args[0] === 'detail') {
                const metrics = ctx.nar.getMetrics();
                if (metrics) {
                    const ruleExecs = metrics.rules?.reduce((sum: number, r: {
                        executions: number
                    }) => sum + r.executions, 0) ?? 0;
                    const derivs = metrics.system?.totalDerivations ?? 0;
                    result += `\nRule Executions: ${ruleExecs}, Derivations: ${derivs}`;
                }
            }
            return result;
        }
    },
    {
        name: '/clear',
        aliases: ['.clear'],
        description: 'Clear all memory',
        usage: '/clear',
        execute: async (_args, ctx) => {
            ctx.nar.clearMemory();
            return 'Memory cleared';
        }
    },
    {
        name: '/quit',
        aliases: ['.quit'],
        description: 'Exit the CLI',
        usage: '/quit',
        execute: async () => {
            process.exit(0);
        }
    }
];