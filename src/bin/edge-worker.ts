#!/usr/bin/env tsx
/**
 * Edge Worker Entry Point — SeNARS on the edge.
 *
 * A minimal, zero-LM worker that runs the device profile with
 * WASM-compatible oracles only. No containers, no external binaries,
 * no Python. Single-file bundle with vendored .wasm modules.
 */

import { createProfileRegistry, type ProfileConfig } from '../profiles/index';
import { createGenomeRegistry } from '../genome/index';
import { createAgentFromEnv, runAgent } from './lib/lifecycle';
import { readAppEnvConfig } from './lib/env-config';

/**
 * Edge worker configuration.
 */
export interface EdgeWorkerConfig {
  /** Profile to use (default: 'device'). */
  profile?: 'device' | 'logic' | 'coprocessor';
  /** Whether to enable Web UI (default: false). */
  enableWebUI?: boolean;
  /** Port for Web UI if enabled (default: 8765). */
  webUIPort?: number;
  /** Custom Env overrides. */
  envOverrides?: Record<string, unknown>;
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
    const { startAgentUI } = await import('../../ui/src/server/index');
    await startAgentUI(agent as never, { port: config.webUIPort ?? 8765 })
      .then(() => console.log(`Web UI at http://localhost:${config.webUIPort ?? 8765}`))
      .catch((err: unknown) => console.error('Web UI failed to start', err));
  } else {
    console.log('SeNARS Edge Worker running (no UI).');
  }
}

/**
 * CLI entry point for edge worker.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const config: EdgeWorkerConfig = {
    profile: args.includes('--profile') ? args[args.indexOf('--profile') + 1] as any : 'device',
    enableWebUI: args.includes('--web-ui'),
    webUIPort: args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1], 10) : 8765,
  };

  if (args.includes('--help')) {
    console.log(`
SeNARS Edge Worker — Zero-LM, WASM-only deployment

Usage: senars-edge [options]

Options:
  --profile <kind>     Profile: device | logic | coprocessor (default: device)
  --web-ui             Enable Web UI
  --port <number>      Web UI port (default: 8765)
  --help               Show this help

Examples:
  senars-edge
  senars-edge --profile logic --web-ui --port 3000
  npx senars-edge --profile coprocessor
`);
    return;
  }

  await runEdgeWorker(config);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});