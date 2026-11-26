/**
 * `senars demo arcade` — Cognitive games as stress tests
 *
 * Extracted from scripts/arcade.ts
 */

import { runEntrypoint } from '../../lib/fatal-error';
import { runCLI, standardSections, type CommonFlags, type HelpSection } from '../../lib/cli-utils';
import { createLogger } from '@senars/util/logger';
import type { CommandModule } from '../../lib/cli';

const logger = createLogger({ scope: 'demo:arcade' });

type Arm = 'manifold' | 'lm' | 'replica' | 'nal' | 'heuristic' | 'random' | 'qlearning' | 'policygradient';

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

async function main(flags: CommonFlags): Promise<void> {
  console.log('🎮 NAR Arcade - Cognitive Games Stress Test');
  console.log('⚠️  Command not yet fully implemented: demo arcade');
  console.log('   Track progress: https://github.com/senars/senars/issues/XXX');
  console.log('');
  console.log('This command will be implemented by extracting from scripts/arcade.ts');
  console.log('Key features to port:');
  console.log('  - Game registry (snake, tetris, 2048, tictactoe, bandit, gridworld)');
  console.log('  - Arm implementations (heuristic, random, manifold, lm, replica, nal, qlearning, policygradient)');
  console.log('  - BrierHarness for calibration metrics');
  console.log('  - Seed-loop for statistical runs');
  console.log('  - Cognitive rules per game');
  console.log('  - Distillation pipeline');
  console.log('  - OpenTelemetry tracing');
  process.exit(1);
}

export const demoArcadeModule: CommandModule = {
  main,
  sections,
};

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runEntrypoint(() => runCLI(main, { sections, version: '0.0.0' }));
}