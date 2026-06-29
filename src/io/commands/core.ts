import type { CommandDefinition } from './registry.js';
import { requireNar } from './utils.js';

export const coreCommands: CommandDefinition[] = [
  {
    name: '/help',
    aliases: ['.help'],
    description: 'Show help information',
    usage: '/help [command]',
    execute: async () => {
      return 'Commands:\n  (term). add belief\n  (term)? ask question\n  /run [n] run inference steps\n  /stats show statistics\n  /clear clear memory\n  /quit exit';
    },
  },
  {
    name: '/run',
    aliases: ['.run'],
    description: 'Run inference steps',
    usage: '/run [n]',
    execute: async (args, ctx) => {
      const nar = requireNar(ctx);
      if (!nar.ok) return nar.message;
      const steps = args[0] ? Number.parseInt(args[0]) : 5;
      const derived = await nar.nar.run(steps);
      return `Ran ${steps} step(s), derived ${derived} belief(s)`;
    },
  },
  {
    name: '/stats',
    aliases: ['.stats'],
    description: 'Show system statistics',
    usage: '/stats [detail]',
    execute: async (args, ctx) => {
      const nar = requireNar(ctx);
      if (!nar.ok) return nar.message;
      const stats = nar.nar.getStatistics();
      let result = `Concepts: ${stats.totalConcepts}, Tasks: ${stats.totalTasks}`;
      if (args[0] === 'detail') {
        const metrics = nar.nar.getMetrics();
        if (metrics) {
          const ruleExecs =
            metrics.rules?.reduce(
              (
                sum: number,
                r: {
                  executions: number;
                }
              ) => sum + r.executions,
              0
            ) ?? 0;
          const derivs = metrics.system?.totalDerivations ?? 0;
          result += `\nRule Executions: ${ruleExecs}, Derivations: ${derivs}`;
        }
      }
      return result;
    },
  },
  {
    name: '/clear',
    aliases: ['.clear'],
    description: 'Clear all memory',
    usage: '/clear',
    execute: async (_args, ctx) => {
      const nar = requireNar(ctx);
      if (!nar.ok) return nar.message;
      nar.nar.clearMemory();
      return 'Memory cleared';
    },
  },
  {
    name: '/quit',
    aliases: ['.quit'],
    description: 'Exit the CLI / disconnect',
    usage: '/quit',
    execute: async () => {
      return '__CLI_QUIT__';
    },
  },
];
