import type { CommandModule } from '../lib/cli';
import { observeCLI } from '@senars/observe/cli';

export const observeModule: CommandModule = {
  name: 'observe',
  description: 'Self-observation & repair loop',
  sections: [
    {
      title: 'observe',
      lines: [
        '  list                    List available observe programs',
        '  run --program <id>      Run a program with observation',
        '  record --command <cmd>  Record any command (debugging/education)',
        '  review <runId>          Review a run bundle',
        '  verify --task <file>    Verify a repair task in shadow worktree',
        '  diff <runA> <runB>      Compare two runs',
        '  bisect --program <id>   Bisect regression',
        '  promote <runId>         Promote verified fix to regression fixture',
        '  export <runId>          Export bundle to GIF/webm/cast/report',
        '  replay <runId>          Replay console cast or serve video',
      ],
    },
  ],
  execute: async (argv: string[]) => {
    const { createNAR } = await import('@senars/nar');
    const { createAgent } = await import('@senars/agent');
    const { createLMService } = await import('@senars/lm');

    const nar = await createNAR();
    const lmService = await createLMService();
    const agent = await createAgent({ nar, lmService });

    const deps = {
      nar,
      episodicMemory: agent.episodicMemory,
      rlfpLearner: agent.rlfpLearner,
      lmService,
    };

    const exitCode = await observeCLI(argv, { deps });
    process.exitCode = exitCode;
    return '';
  },
};