import type { CommandDefinition } from '@senars/core/command-types';

export const rlfpCommands: CommandDefinition[] = [
  {
    name: '/drives',
    aliases: ['.drives'],
    description: 'Show drive states',
    usage: '/drives',
    execute: async (_args, ctx) => {
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
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
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
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
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
      const rlfp = nar.getRLFPState?.();
      if (!rlfp) return 'RLFP not configured';
      return `RLFP State:\nPolicy: ${rlfp.policy ?? 'unknown'}\nReward: ${rlfp.reward ?? 0}`;
    },
  },
];
