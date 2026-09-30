import type { CommandDefinition } from '@senars/util';
import { NAR_UNCONFIGURED, narOf } from './utils.js';

export const rlfpCommands: CommandDefinition[] = [
  {
    name: '/drives',
    aliases: ['.drives'],
    description: 'Show drive states',
    usage: '/drives',
    execute: async (_args, ctx) => {
      const nar = narOf(ctx);
      if (!nar) return NAR_UNCONFIGURED;
      const drives = nar.getDriveManager?.()?.getAllStates?.() ?? [];
      if (drives.length === 0) return 'No drives configured';
      return drives
        .map(
          (d: any) =>
            `${d.name}: urgency=${d.urgency?.toFixed(3)}, satisfaction=${d.satisfaction?.toFixed(3)}`
        )
        .join('\n');
    },
  },
  {
    name: '/drive',
    aliases: ['.drive'],
    description: 'Show drive details',
    usage: '/drive <name>',
    execute: async (args, ctx) => {
      const nar = narOf(ctx);
      if (!nar) return NAR_UNCONFIGURED;
      const name = args[0];
      if (!name) return 'Usage: /drive <name>';
      const state = nar.getDriveManager?.()?.getState?.(name);
      if (!state) return `Drive not found: ${name}`;
      return JSON.stringify(state, null, 2);
    },
  },
  {
    name: '/rl-status',
    aliases: ['.rl-status'],
    description: 'Show RLFP status',
    usage: '/rl-status',
    execute: async (_args, ctx) => {
      const nar = narOf(ctx);
      if (!nar) return NAR_UNCONFIGURED;
      const rlfp = nar.getRLFP();
      if (!rlfp) return 'RLFP not configured';
      return `RLFP State:\nTrajectories: ${rlfp.trajectoryCount}\nPreferences: ${rlfp.preferences.length}`;
    },
  },
];
