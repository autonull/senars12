import type {CommandContext, CommandDefinition} from './registry.js';

export const lmCommands: CommandDefinition[] = [
    {
        name: '.lm-status',
        description: 'Show language model status',
        usage: '.lm-status',
  execute: async (_args, ctx) => {
    const narAny = ctx.nar as any;
    const lm = narAny.getLMClient?.();
    if (!lm) {
      return 'LM client not configured';
    }
    return `LM Status:\nProvider: ${lm.provider ?? 'unknown'}\nModel: ${lm.model ?? 'unknown'}\nAvailable: ${lm.available ? 'Yes' : 'No'}`;
  }
    },
    {
        name: '.lm-switch',
        description: 'Switch language model',
        usage: '.lm-switch ',
  execute: async (args, ctx) => {
    const model = args[0];
    if (!model) {
      return 'Usage: .lm-switch ';
    }
    const narAny = ctx.nar as any;
    const lm = narAny.getLMClient?.();
    if (!lm) {
      return 'LM client not configured';
    }
    if (typeof lm.setModel === 'function') {
      lm.setModel(model);
      return `Switched to model: ${model}`;
    }
    return 'Model switching not supported by this LM client';
  }
    }
];