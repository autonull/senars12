/**
 * `senars run` — Run agent with profile (default command).
 */

import type { CommonFlags, HelpSection } from '../lib/cli-utils';
import { runCLI, standardSections } from '../lib/cli-utils';
import { getProfileRegistry } from '../lib/cli-utils';
import { createAgentFromEnv, runAgent } from '../lib/lifecycle';
import { maybeStartWebUI } from '../lib/entrypoint-base';
import { readAppEnvConfig } from '../lib/env-config';
import { createLogger } from '@senars/util/logger';
import { runEntrypoint } from '../lib/fatal-error';
import type { CommandModule } from '../lib/cli';

export const sections: HelpSection[] = [
  standardSections.usage('senars run', 'Run agent with profile (default)'),
  {
    title: 'Options',
    lines: [
      '-p, --profile <kind>    Profile: logic | coprocessor | agent | device (default: agent)',
      '--web-ui                Enable Web UI',
      '--port <number>         Web UI port (default: 8765)',
    ],
  },
  standardSections.examples([
    'senars run',
    'senars run --profile agent',
    'senars run --profile logic --web-ui',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const registry = await getProfileRegistry();
  const profile = registry.get(flags.profile ?? 'agent');

  if (!profile) {
    console.error(`Unknown profile: ${flags.profile}`);
    process.exit(1);
  }

  console.log(`Starting SeNARS with profile: ${profile.name} (${profile.kind})`);

  if (profile.requiresLM) {
    const envConfig = readAppEnvConfig();
    if (!envConfig.enableWebUI) {
      console.warn('Warning: Profile requires LM but no LM configured. Set LM_API_KEY or LM_ENDPOINT.');
    }
  }

  const { agent } = await createAgentFromEnv({ narConfig: { maxConcepts: 100 } });
  await runAgent(agent);
  await maybeStartWebUI(agent, flags.webUI, flags.webUIPort, createLogger({ scope: 'senars' }));
}

export const runModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runEntrypoint(() => runCLI(main, { sections }));
}