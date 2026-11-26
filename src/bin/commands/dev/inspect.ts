/**
 * `senars dev inspect` — Inspect internal state.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';
import { createAgentFromEnv } from '../../lib/lifecycle';

const logger = createLogger({ scope: 'dev:inspect' });

export const sections: HelpSection[] = [
  standardSections.usage('senars dev inspect', 'Inspect internal state'),
  {
    title: 'Options',
    lines: [
      '--component <name>     Component to inspect: nar|agent|memory|systemOne|gates',
      '--path <json-path>     JSON path within component (e.g., gates.groundedness)',
      '--watch                Watch for changes',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars dev inspect --component nar',
    'senars dev inspect --component gates --path groundedness --watch',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const component = argv.str('--component', 'nar');
  const path = argv.str('--path');
  const watch = argv.has('--watch');

  const { nar, agent, dispose } = await createAgentFromEnv();

  try {
    let output: unknown = {};

    switch (component) {
      case 'nar':
        output = {
          concepts: nar.concepts?.size ?? 0,
          gates: Object.keys(nar.gates ?? {}).length,
          config: nar.config,
        };
        break;
      case 'agent':
        output = { profile: agent.profile };
        break;
      case 'memory':
        output = { concepts: nar.concepts?.size ?? 0 };
        break;
      case 'systemOne':
        output = { enabled: (nar as any).systemOne?.enabled ?? false };
        break;
      case 'gates':
        output = nar.gates ?? {};
        break;
      default:
        output = { error: `Unknown component: ${component}` };
    }

    if (path) {
      const parts = path.split('.');
      output = parts.reduce((acc: any, p) => acc?.[p], output);
    }

    if (jsonOutput) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(`Inspecting ${component}${path ? ` (${path})` : ''}:`);
      console.log(JSON.stringify(output, null, 2));
    }
  } finally {
    await nar.dispose();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}