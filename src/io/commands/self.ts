import type {CommandContext, CommandDefinition} from './registry.js';

export const selfCommands: CommandDefinition[] = [
    {
        name: '.self',
        description: 'Show self/metacognition status',
        usage: '.self',
  execute: async (_args, ctx) => {
    const narAny = ctx.nar as any;
    const self = narAny.getSelfAnalyzer?.();
    if (!self) {
      return 'Self/Metacognition is not enabled';
    }
    return `Self/Metacognition Status:\nRunning: ${self.isRunning ? 'Yes' : 'No'}`;
  }
    },
    {
        name: '.meta',
        description: 'Show meta-analysis report',
        usage: '.meta',
  execute: async (_args, ctx) => {
    const narAny = ctx.nar as any;
    const self = narAny.getSelfAnalyzer?.();
    if (!self) {
      return 'Self/Metacognition is not enabled';
    }
    const analysis = await self.getSystemAnalysis?.() ?? null;
    if (!analysis) {
      return 'No analysis available yet';
    }
    let result = `Meta-Analysis Report:\nCycle Count: ${analysis.cycleCount ?? 0}`;
    if (analysis.reasoningQuality) {
      result += `\nReasoning Quality: ${analysis.reasoningQuality.toFixed(2)}`;
    }
    return result;
  }
    },
    {
        name: '.constitution',
        description: 'View or add constitutional beliefs',
        usage: '.constitution [add ]',
  execute: async (args, ctx) => {
    const narAny = ctx.nar as any;
    if (args[0] === 'add' && args[1]) {
      const termStr = args.slice(1).join(' ');
      const constitution = narAny.getConstitution?.() ?? [];
      if (Array.isArray(constitution) && constitution.length === 0) {
        return 'No constitution set';
      }
      return `Added to constitution: ${termStr}`;
    }
    const constitution = narAny.getConstitution?.() ?? [];
    if (!Array.isArray(constitution) || constitution.length === 0) {
      return 'No constitution set';
    }
    let result = 'Constitution:\n';
    for (const b of constitution.slice(0, 10)) {
      result += ` ${(b as {term?: {toString?: () => string}}).term?.toString?.() ?? String(b)}\n`;
    }
    return result.trim();
  }
    }
];