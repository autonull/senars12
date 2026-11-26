#!/usr/bin/env tsx
/**
 * Edge Worker Entry Point — SeNARS on the edge.
 *
 * A minimal, zero-LM worker that runs the device profile with
 * WASM-compatible oracles only. No containers, no external binaries,
 * no Python. Single-file bundle with vendored .wasm modules.
 */

import { createProfileRegistry } from '../profiles/index';
import { createAgentFromEnv, runAgent } from './lib/lifecycle';
import { readAppEnvConfig } from './lib/env-config';
import { runEntrypoint } from './lib/fatal-error';
import { runCLI, buildHelp, standardSections, parseCommonFlags, showHelpAndExit, profileHelpSection, maybeStartWebUI } from './lib/cli-utils';
import { createLogger } from '@senars/util/logger';

const logger = createLogger({ scope: 'edge-worker' });

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
  const registry = createProfileRegistry();
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

/** Main CLI entry point. */
async function main(): Promise<void> {
  const { parseFlags } = await import('@senars/util/cli');
  const flags = parseCommonFlags(parseFlags());
  const profiles = ['device', 'logic', 'coprocessor'] as const;

  const sections = [
    standardSections.usage('senars-edge', 'SeNARS Edge Worker — Zero-LM, WASM-only deployment'),
    profileHelpSection(profiles.map((p) => ({ kind: p, name: p, description: 'Zero-LM profile' }))),
    {
      title: 'Options',
      lines: [
        '--web-ui             Enable Web UI',
        '--port <number>      Web UI port (default: 8765)',
      ],
    },
    standardSections.examples([
      'senars-edge',
      'senars-edge --profile logic --web-ui --port 3000',
      'npx senars-edge --profile coprocessor',
    ]),
  ];

  if (flags.help) {
    showHelpAndExit(sections);
  }

  const config: EdgeWorkerConfig = {
    profile: (flags.profile as EdgeWorkerConfig['profile']) ?? 'device',
    enableWebUI: flags.webUI,
    webUIPort: flags.webUIPort,
  };

  await runEdgeWorker(config);
}

runEntrypoint(main);