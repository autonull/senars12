#!/usr/bin/env tsx
/**
 * Edge Worker Entry Point — SeNARS on the edge.
 *
 * A minimal, zero-LM worker that runs the device profile with
 * WASM-compatible oracles only. No containers, no external binaries,
 * no Python. Single-file bundle with vendored .wasm modules.
 *
 * @deprecated Use `senars edge run` instead. This entry point will be removed in a future version.
 */

import { createLogger } from '@senars/util/logger';

// Deprecation warning
const logger = createLogger({ scope: 'edge-worker' });
logger.warn('DEPRECATION: `senars-edge` is deprecated. Use `senars edge run` instead.');

import { createAgentFromEnv, runAgent } from './lib/lifecycle';
import { readAppEnvConfig } from './lib/env-config';
import { runEntrypoint } from './lib/fatal-error';
import { runCLI, standardSections, profileHelpSection, maybeStartWebUI, type CommonFlags, type HelpSection, getProfileRegistry } from './lib/cli-utils';

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

/** Help sections for the edge worker. */
const sections: HelpSection[] = [
  standardSections.usage('senars-edge', 'SeNARS Edge Worker — Zero-LM, WASM-only deployment'),
  profileHelpSection(
    ['device', 'logic', 'coprocessor'].map((p) => ({ kind: p, name: p, description: 'Zero-LM profile' }))
  ),
  {
    title: 'Options',
    lines: [
      '--web-ui             Enable Web UI',
      '--port <number>      Web UI port (default: 8765)',
      '-v, --version        Show version',
      '--verbose            Verbose output',
      '--quiet              Suppress non-error output',
    ],
  },
  standardSections.examples([
    'senars-edge',
    'senars-edge --profile logic --web-ui --port 3000',
    'npx senars-edge --profile coprocessor',
  ]),
];

/** Main CLI entry point. */
async function main(flags: CommonFlags): Promise<void> {
  const config: EdgeWorkerConfig = {
    profile: (flags.profile as EdgeWorkerConfig['profile']) ?? 'device',
    enableWebUI: flags.webUI,
    webUIPort: flags.webUIPort,
  };

  await runEdgeWorker(config);
}

runEntrypoint(() => runCLI(main, { sections, version: '0.0.0' }));