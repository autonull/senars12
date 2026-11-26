/**
 * `senars demo` — Demo commands (playground, arcade, benchmark, imagine).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { demoPlaygroundModule } from './playground';
import { demoArcadeModule } from './arcade';
import { demoBenchmarkModule } from './benchmark';
import { demoImagineModule } from './imagine';

// Register demo subcommands
registerCommand('demo playground', demoPlaygroundModule);
registerCommand('demo arcade', demoArcadeModule);
registerCommand('demo benchmark', demoBenchmarkModule);
registerCommand('demo imagine', demoImagineModule);

export const demoModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars demo <playground|arcade|benchmark|imagine>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars demo <playground|arcade|benchmark|imagine> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  playground    Interactive REPL with tutorials',
        '  arcade        Cognitive games as stress tests',
        '  benchmark     Standardized performance benchmarks',
        '  imagine       Cognitive treadmill / scenario generation',
      ],
    },
  ],
  subcommands: new Map([
    ['playground', demoPlaygroundModule],
    ['arcade', demoArcadeModule],
    ['benchmark', demoBenchmarkModule],
    ['imagine', demoImagineModule],
  ]),
};