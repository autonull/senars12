/**
 * `senars session start` — Start a new session.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createLogger, parseFlags, jsonMode } from '@senars/util';
import { ulid } from 'ulid';

const logger = createLogger({ scope: 'session:start' });

export const sections: HelpSection[] = [
  standardSections.usage('senars session start', 'Start a new session'),
  {
    title: 'Options',
    lines: [
      '--profile <kind>       Profile to use (default: agent)',
      '--fork <session-id>    Fork from existing session',
      '--replay               Replay session from start',
      '--label <name>         Human-readable label',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars session start',
    'senars session start --profile logic',
    'senars session start --fork abc123 --label "experiment branch"',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const profile = argv.str('--profile', 'agent');
  const fork = argv.str('--fork');
  const replay = argv.has('--replay');
  const label = argv.str('--label');

  // This is a stub - session persistence would need to be implemented
  const sessionId = ulid();
  const output = {
    sessionId,
    profile,
    label,
    forkedFrom: fork,
    replay,
    startedAt: new Date().toISOString(),
    status: 'active',
  };

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Session started: ${sessionId}`);
    console.log(`  Profile: ${profile}`);
    if (label) console.log(`  Label: ${label}`);
    if (fork) console.log(`  Forked from: ${fork}`);
    if (replay) console.log(`  Replay mode: true`);
  }
}

export const sessionStartModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}