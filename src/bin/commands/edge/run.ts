/**
 * `senars edge run` — Edge Worker (Zero-LM, WASM-only deployment)
 *
 * A minimal worker that runs the device profile with
 * WASM-compatible oracles only. No containers, no external binaries,
 * no Python. Single-file bundle with vendored .wasm modules.
 */

import { createAgentFromEnv, runAgent } from '../../lib/lifecycle';
import { readAppEnvConfig } from '../../lib/env-config';
import { runEntrypoint } from '../../lib/fatal-error';
import { maybeStartWebUI } from '../../lib/entrypoint-base';
import { standardSections, profileHelpSection, type CommonFlags, type HelpSection, getProfileRegistry } from '../../lib/cli-utils';
import { createLogger } from '@senars/util/logger';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

const logger = createLogger({ scope: 'edge:run' });

/** Edge worker configuration. */
export interface EdgeWorkerConfig {
  /** Profile to use (default: 'device'). */
  profile?: 'device' | 'logic' | 'coprocessor';
  /** Whether to enable Web UI (default: false). */
  enableWebUI?: boolean;
  /** Port for Web UI if enabled (default: 8765). */
  webUIPort?: number;
}

/**
 * Create and run the edge worker.
 */
export async function runEdgeWorker(config: EdgeWorkerConfig = {}): Promise<void> {
  const profileKind = config.profile ?? 'device';
  const registry = await getProfileRegistry();
  const profile = registry.get(profileKind);

  if (!profile) {
    console.error(`Unknown profile: ${profileKind}`);
    process.exit(1);
  }

  if (profile.requiresLM) {
    console.warn(`Warning: Profile '${profileKind}' requires LM but edge worker runs without LM.`);
  }

  console.log(`Starting SeNARS Edge Worker with profile: ${profile.name} (${profile.kind})`);
  console.log(`Faculties: ${profile.faculties.join(', ')}`);
  console.log(`Oracles: ${profile.oracles.join(', ')}`);
  console.log(`Packs: ${profile.packs.join(', ')}`);

  // Create agent with device profile settings
  const { agent } = await createAgentFromEnv({
    narConfig: {
      maxConcepts: 100,
      fuelBudget: 1000,
      maxDepth: 10,
      enableTemporal: false,
    },
  });

  await runAgent(agent);

  if (config.enableWebUI) {
    await maybeStartWebUI(agent, true, config.webUIPort ?? 8765, logger);
  } else {
    console.log('SeNARS Edge Worker running (no UI).');
  }
}

export const sections = createCommandModule({
  name: 'edge run',
  description: 'Run edge worker (zero-LM, WASM-only)',
  usage: 'senars edge run [options]',
  sections: [
    profileHelpSection(
      ['device', 'logic', 'coprocessor'].map((p) => ({ kind: p, name: p, description: 'Zero-LM profile' }))
    ),
    { lines: ['-p, --profile <kind>     Select profile: device | logic | coprocessor (default: device)', '--web-ui                 Enable Web UI', '--port <number>          Web UI port (default: 8765)', '-v, --version            Show version', '--verbose                Verbose output', '--quiet                  Suppress non-error output'] },
  ],
  examples: [
    'senars edge run',
    'senars edge run --profile logic --web-ui --port 3000',
    'npx senars edge run --profile coprocessor',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const config: EdgeWorkerConfig = {
      profile: (flagHelpers.str(rawFlags, '--profile', flags.profile as string) as EdgeWorkerConfig['profile']) ?? 'device',
      enableWebUI: flags.webUI,
      webUIPort: flags.webUIPort,
    };

    await runEdgeWorker(config);
  }, flags, 'edge run');
});

export const edgeRunModule: CommandModule = { main: sections.main, sections: sections.sections };

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}