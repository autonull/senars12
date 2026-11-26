/**
 * `senars doctor` — Health check and diagnostic commands.
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { doctorCheckModule } from './check';
import { doctorStatusModule } from './status';
import { doctorReportModule } from './report';
import { doctorTuneModule } from './tune';
import { doctorBenchModule } from './bench';

// Register doctor subcommands
registerCommand('doctor check', doctorCheckModule);
registerCommand('doctor status', doctorStatusModule);
registerCommand('doctor report', doctorReportModule);
registerCommand('doctor tune', doctorTuneModule);
registerCommand('doctor bench', doctorBenchModule);

export const doctorModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars doctor <check|status|report|tune|bench>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars doctor <check|status|report|tune|bench> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  check    Run onboarding health check',
        '  status   Show quick system status',
        '  report   Generate comprehensive diagnostic report',
        '  tune     Run self-tuning optimization',
        '  bench    Run micro-benchmarks',
      ],
    },
  ],
  subcommands: new Map([
    ['check', doctorCheckModule],
    ['status', doctorStatusModule],
    ['report', doctorReportModule],
    ['tune', doctorTuneModule],
    ['bench', doctorBenchModule],
  ]),
};