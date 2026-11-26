/**
 * `senars demo arcade` — Cognitive games as stress tests
 *
 * Extracted from scripts/arcade.ts
 */

import { runEntrypoint } from '../../lib/fatal-error';
import { standardSections, type HelpSection } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createStubModule } from '../../lib/command-base';

export const sections: HelpSection[] = [
  standardSections.usage('senars demo arcade', 'Cognitive games as stress tests'),
  {
    title: 'Options',
    lines: [
      '--games <list>           Comma-separated games: snake,tetris,2048,tictactoe,bandit,gridworld (default: all)',
      '--arms <list>            Comma-separated arms: heuristic,random,manifold,lm,replica,nal,qlearning,policygradient (default: heuristic,random)',
      '--episodes <n>           Episodes per game (default: 3)',
      '--seeds <n>              Number of seeds for statistical runs (default: 1)',
      '--seed <n>               Base random seed (default: 7)',
      '--render                 Render game state each tick',
      '--mode <type>            Mode: default | cognitive (default: default)',
      '--resume                 Resume interrupted tournament',
      '--session <path>         Session file path (default: .reports/arcade-session.json)',
      '--otel                   Enable OpenTelemetry tracing',
      '--distill                Run distillation after LM arm play',
      '-v, --version            Show version',
      '--verbose                Verbose output',
      '--quiet                  Suppress non-error output',
    ],
  },
  standardSections.examples([
    'senars demo arcade --games snake,tetris --arms heuristic,random --episodes 5',
    'senars demo arcade --arms manifold --seeds 5 --episodes 3',
    'senars demo arcade --arms lm --distill',
    'senars demo arcade --games bandit --arms replica --resume',
  ]),
];

export const demoArcadeModule: CommandModule = createStubModule('demo arcade', 'https://github.com/senars/senars/issues/XXX');

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(demoArcadeModule.main, { sections: demoArcadeModule.sections, version: '0.0.0' });
}