import type { CommandDefinition } from '@senars/util';
import { narOf, requiring } from './utils.js';

export const lmCommands: CommandDefinition[] = [
  {
    name: '/lm-status',
    aliases: ['.lm-status'],
    description: 'Show language model status',
    usage: '/lm-status',
    execute: requiring('NAR', narOf, async (nar) => {
      const lm = nar.getLMClient();
      if (!lm) return 'LM client not configured';
      return `LM Status:\nProvider: ${lm.provider ?? 'unknown'}\nModel: ${lm.model ?? 'unknown'}\nAvailable: ${lm.available ? 'Yes' : 'No'}`;
    }),
  },
  {
    name: '/lm-switch',
    aliases: ['.lm-switch'],
    description: 'Switch language model (not available for current provider)',
    usage: '/lm-switch <model>',
    execute: async (_args, _ctx) => {
      return 'Model switching not supported by current LM service';
    },
  },
];
